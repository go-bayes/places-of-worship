// domain-redirect — path-preserving 301s onto the canonical domain.
// every alternate hostname (powmap.org, www.powmap.org, and later the
// placesmap.org pair) attaches to this worker as a custom domain, so a
// deep link to any country map lands on the same page under
// religionmap.org (jb ruling 2026-07-17).
export default {
  fetch(request) {
    const url = new URL(request.url);
    url.hostname = "religionmap.org";
    url.protocol = "https:";
    url.port = "";
    return Response.redirect(url.toString(), 301);
  }
};
