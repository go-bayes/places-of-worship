(function () {
    const target = new URL(document.getElementById("portal-redirect-link").href);
    const params = new URLSearchParams(window.location.search);
    params.set("country", target.searchParams.get("country"));
    target.search = params.toString();
    target.hash = window.location.hash;
    window.location.replace(target.toString());
})();
