"""bounded public HTTP reads with DNS-pinned sockets and verified TLS."""
from __future__ import annotations

import http.client
import ipaddress
import socket
import ssl
from urllib.parse import urlsplit


class UnsafeURL(ValueError):
    """the destination is outside the public HTTP fetch boundary."""


# classify literal hosts before resolution; DNS answers are checked separately.
def is_blocked_host(hostname: str) -> bool:
    host = (hostname or "").lower().strip("[]").rstrip(".")
    if not host or host == "localhost" or host.endswith((".localhost", ".local", ".internal")) or "%" in host:
        return True
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False
    if isinstance(address, ipaddress.IPv6Address):
        if address.ipv4_mapped:
            address = address.ipv4_mapped
        elif address in ipaddress.ip_network("64:ff9b::/96"):
            address = ipaddress.IPv4Address(int(address) & 0xFFFFFFFF)
        elif address.sixtofour is not None or address.teredo is not None:
            return True
    return not address.is_global or address.is_multicast


# parse an HTTP URL and reject credentials, control characters, and private literals.
def parse_public_url(url: str):
    if any(ord(c) < 32 or ord(c) == 127 for c in url):
        raise UnsafeURL("control character in URL")
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError as exc:
        raise UnsafeURL("invalid URL") from exc
    if parsed.scheme not in ("http", "https") or parsed.username is not None or parsed.password is not None:
        raise UnsafeURL("only credential-free HTTP(S) URLs are permitted")
    if is_blocked_host(parsed.hostname or "") or port == 0:
        raise UnsafeURL("blocked destination")
    return parsed


# resolve once, check every answer, and connect directly to an approved numeric address.
def public_socket(host: str, port: int, timeout: float):
    if is_blocked_host(host):
        raise UnsafeURL("blocked destination")
    addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    if not addresses or any(is_blocked_host(row[4][0]) for row in addresses):
        raise UnsafeURL("DNS returned a non-public address")
    last_error = None
    for family, kind, proto, _, address in addresses:
        sock = socket.socket(family, kind, proto)
        try:
            sock.settimeout(timeout)
            sock.connect(address)
            return sock
        except OSError as exc:
            last_error = exc
            sock.close()
    raise last_error or OSError("no usable public address")


class PublicConnection(http.client.HTTPConnection):
    # retain the original hostname for Host and TLS verification while pinning the socket.
    def __init__(self, host: str, port: int, timeout: float, secure: bool):
        super().__init__(host, port, timeout=timeout)
        self.secure = secure

    # create a checked connection without proxy environment variables or a second DNS lookup.
    def connect(self):
        sock = public_socket(self.host, self.port, self.timeout)
        try:
            self.sock = ssl.create_default_context().wrap_socket(sock, server_hostname=self.host) if self.secure else sock
        except Exception:
            sock.close()
            raise


# fetch a single hop; callers must explicitly handle redirects and robots policy.
def request_once(url: str, headers: dict, timeout: float, max_bytes: int):
    parsed = parse_public_url(url)
    host = parsed.hostname.encode("idna").decode("ascii")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    connection = PublicConnection(host, port, timeout, parsed.scheme == "https")
    try:
        path = parsed.path or "/"
        if parsed.query:
            path += "?" + parsed.query
        connection.request("GET", path, headers=headers)
        response = connection.getresponse()
        body = response.read(max_bytes + 1)
        if len(body) > max_bytes:
            raise ValueError("response exceeds byte limit")
        return response.status, body, response.headers
    finally:
        connection.close()
