(function () {
    const DEFAULT_CONFIG = {
        enabled: false,
        url: "",
        googleClientId: "",
        // workos authkit sessions (jb 2026-11-03): set, the portals sign in
        // through workos (google behind it) and the session renews silently;
        // empty, they keep the google id token below
        workosClientId: "",
        countryCode: "NZ",
    };
    const AUTH_REFRESH_MARGIN_MS = 5 * 60 * 1000;
    const AUTH_REFRESH_TIMEOUT_MS = 30 * 1000;
    // the sign-in token stays on the device between page loads (jb
    // 2026-09-05, after guy's phone reloaded the tab each time he checked a
    // photo): a bearer token of at most an hour, on the device that signed
    // in, cleared by the sign-out button and by expiry
    const AUTH_STORAGE_KEY = "powConvexAuth:v1";
    const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
    const scriptLoads = new Map();

    // workos mode. authkit-js keeps its refresh token in this page's local
    // storage (devMode: true, set explicitly): its production mode renews
    // through a cookie on api.workos.com, which ios safari blocks as a
    // third-party cookie (jb 2026-11-03, option a). the page's strict
    // content-security-policy is the mitigation; a custom auth domain is
    // the planned upgrade. the key is authkit-js 0.20.5's own
    // (src/utils/session-data.ts), read only to know whether a session can
    // be restored before the library loads
    const WORKOS_REFRESH_KEY_PREFIX = "workos:refresh-token";
    // the sign-in hand-off in this tab's session storage: where to return,
    // the ra's initials for claimInvite, and, once the callback page has
    // exchanged the code, when it did
    const WORKOS_RETURN_KEY = "powWorkosReturn:v1";
    const WORKOS_CALLBACK_PAGE = "auth-callback.html";
    const WORKOS_SIGN_OUT_PAGE = "verification.html";
    const WORKOS_RETURN_MAX_AGE_MS = 15 * 60 * 1000;

    function workosRefreshTokenStored(clientId) {
        try {
            return Boolean(
                window.localStorage.getItem(`${WORKOS_REFRESH_KEY_PREFIX}:${clientId}`)
                || window.localStorage.getItem(WORKOS_REFRESH_KEY_PREFIX),
            );
        } catch (error) {
            return false;
        }
    }

    function forgetWorkosRefreshToken(clientId) {
        try {
            window.localStorage.removeItem(`${WORKOS_REFRESH_KEY_PREFIX}:${clientId}`);
            window.localStorage.removeItem(WORKOS_REFRESH_KEY_PREFIX);
        } catch (error) {
            // storage unavailable: nothing kept
        }
    }

    function readWorkosReturn() {
        try {
            const record = JSON.parse(window.sessionStorage.getItem(WORKOS_RETURN_KEY) || "null");
            return record && typeof record === "object" ? record : null;
        } catch (error) {
            return null;
        }
    }

    function writeWorkosReturn(record) {
        try {
            if (record) window.sessionStorage.setItem(WORKOS_RETURN_KEY, JSON.stringify(record));
            else window.sessionStorage.removeItem(WORKOS_RETURN_KEY);
        } catch (error) {
            // blocked storage: the return falls back to the portal's own page
        }
    }

    // the hand-off of a sign-in the callback page has just completed, taken
    // once; an old or unfinished hand-off is dropped
    function takeCompletedWorkosReturn() {
        const record = readWorkosReturn();
        if (!record?.signedInAt) return null;
        writeWorkosReturn(null);
        return Date.now() - Number(record.signedInAt) <= WORKOS_RETURN_MAX_AGE_MS ? record : null;
    }

    // a same-origin path to return to, never another site: the stored value
    // came from this tab, but the callback page treats it as input
    function sameOriginReturn(value, fallback) {
        try {
            const url = new URL(String(value || ""), window.location.href);
            if (url.origin !== window.location.origin) return fallback;
            if (url.pathname.endsWith(`/${WORKOS_CALLBACK_PAGE}`)) return fallback;
            const path = `${url.pathname}${url.search}${url.hash}`;
            // a path that opens with // (or /\) reads as another host when
            // handed to location.replace
            if (!path.startsWith("/") || /^\/[/\\]/.test(path)) return fallback;
            return path;
        } catch (error) {
            return fallback;
        }
    }

    function workosLibrary() {
        const library = window.WorkOSAuthKit;
        if (!library?.createClient) {
            throw new Error("WorkOS sign-in did not load. Reload the page, then try again.");
        }
        return library;
    }

    // an authkit failure that leaves the session in place (network, 5xx,
    // rate limit, lock timeout) as opposed to one that ends it
    function isTransientAuthkitError(error) {
        return error?.isTransient === true;
    }

    function expiredSignInError() {
        const error = new Error("Your sign-in expired. Sign in again, then retry.");
        error.authExpired = true;
        return error;
    }

    // a deployment that predates a function answers with this message; the
    // client then falls back to the reads it replaces, so it can ship before
    // or after the backend deploy
    function isMissingFunctionError(error) {
        return /Could not find public function/i.test(String(error?.message || ""));
    }

    function normaliseConfig(config) {
        return { ...DEFAULT_CONFIG, ...(config || {}) };
    }

    function loadScriptOnce(src) {
        if (scriptLoads.has(src)) return scriptLoads.get(src);
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            return Promise.resolve();
        }
        const load = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Could not load ${src}`));
            document.head.appendChild(script);
        });
        scriptLoads.set(src, load);
        return load;
    }

    function readStoredAuthToken() {
        try {
            const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
            const record = raw ? JSON.parse(raw) : null;
            return typeof record?.token === "string" ? record.token : "";
        } catch (error) {
            return "";
        }
    }

    function writeStoredAuthToken(token) {
        try {
            if (token) {
                window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, saved_at: Date.now() }));
            } else {
                window.localStorage.removeItem(AUTH_STORAGE_KEY);
            }
        } catch (error) {
            // private windows or blocked storage: the session lives in memory only
        }
    }

    function compactObject(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entry]) => entry !== undefined && entry !== ""),
        );
    }

    function jwtExpiryMs(token) {
        const payload = String(token || "").split(".")[1];
        if (!payload) return 0;
        try {
            const normalised = payload.replaceAll("-", "+").replaceAll("_", "/");
            const decoded = JSON.parse(atob(normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=")));
            return Number(decoded.exp) ? Number(decoded.exp) * 1000 : 0;
        } catch (error) {
            return 0;
        }
    }

    class PowConvexTaskClient {
        constructor(config) {
            this.config = normaliseConfig(config);
            this.authToken = "";
            this.authExpiresAt = 0;
            this.authRefreshTimer = 0;
            this.authRefreshPromise = null;
            this.credentialWaiters = [];
            this.signInOptions = {};
            this.user = null;
            // workos mode: the authkit client, made on first need, and a
            // refusal from the last sign-in that the sign-in card says once
            this.authkit = null;
            this.authkitPromise = null;
            this.signInError = null;
            this.workosClaimed = false;
            if (this.usesWorkos) {
                // the session lives in authkit's refresh token; a google
                // token left from before the switch is dropped
                writeStoredAuthToken("");
                return;
            }
            // a token kept from before a reload comes back with its refresh
            // timer; restoreSession() then names the user again. a token
            // inside its refresh margin is dropped rather than restored
            // into a session that ends mid-entry
            const stored = readStoredAuthToken();
            if (stored && jwtExpiryMs(stored) - Date.now() > AUTH_REFRESH_MARGIN_MS) {
                this.setAuthToken(stored);
            } else if (stored) {
                writeStoredAuthToken("");
            }
        }

        // one constant switches both portals: workosClientId in
        // convex-config.js. empty keeps the google id token
        get usesWorkos() {
            return Boolean(this.config.workosClientId);
        }

        get configured() {
            const signIn = this.usesWorkos ? this.config.workosClientId : this.config.googleClientId;
            return Boolean(this.config.enabled && this.config.url && signIn);
        }

        get signedIn() {
            return Boolean(this.authToken && this.user);
        }

        // whether a reload can name the user without the sign-in card: a
        // kept google token, or a kept workos refresh token
        get canRestoreSession() {
            if (!this.configured) return false;
            return this.usesWorkos
                ? workosRefreshTokenStored(this.config.workosClientId)
                : Boolean(this.authToken);
        }

        // deliberate: the sign-out button. google's auto-select cooldown is
        // for a chosen sign-out only; an expiry must not make the next
        // automatic re-selection less likely. in workos mode every sign-out
        // ends the workos session as well, so the kept refresh token goes
        signOut({ deliberate = false } = {}) {
            this.clearAuth();
            if (this.usesWorkos) {
                this.endWorkosSession();
                return;
            }
            if (deliberate && window.google?.accounts?.id?.disableAutoSelect) {
                window.google.accounts.id.disableAutoSelect();
            }
        }

        // authkit's sign-out without leaving the page: it forgets the
        // session in memory and storage and asks workos to end it. the
        // device copy is cleared here too, for a session authkit never
        // loaded on this page
        endWorkosSession() {
            const authkit = this.authkit;
            if (authkit) {
                try {
                    const ending = authkit.signOut({ navigate: false, returnTo: this.workosSignOutUri() });
                    ending?.catch?.(() => {});
                } catch (error) {
                    // no session in memory: nothing for workos to end
                }
            }
            forgetWorkosRefreshToken(this.config.workosClientId);
        }

        // where workos sends a sign-out: the contributor portal on this
        // origin (localhost when checked locally), one sign-out uri per
        // origin. the page stays put; the redirect only answers the fetch
        workosSignOutUri() {
            if (this.config.workosSignOutUri) return this.config.workosSignOutUri;
            return new URL(WORKOS_SIGN_OUT_PAGE, window.location.href).href;
        }

        // the address workos returns to: one callback page beside the
        // portals, so one redirect uri per origin serves both
        workosRedirectUri() {
            if (this.config.workosRedirectUri) return this.config.workosRedirectUri;
            return new URL(WORKOS_CALLBACK_PAGE, window.location.href).href;
        }

        // the authkit client, made once per page. creating it renews a kept
        // session from its refresh token
        async ensureAuthKit() {
            if (!this.usesWorkos) return null;
            if (!this.authkitPromise) {
                this.authkitPromise = Promise.resolve()
                    .then(() => workosLibrary().createClient(this.config.workosClientId, {
                        devMode: true,
                        redirectUri: this.workosRedirectUri(),
                        onRefresh: ({ accessToken }) => {
                            // a renewal replaces the token only for a live session
                            if (this.authToken) this.setWorkosAccessToken(accessToken);
                        },
                        // the session could not be renewed: end it here, so
                        // the next request reads as an expired sign-in
                        onRefreshFailure: () => this.signOut(),
                    }))
                    .then((authkit) => {
                        this.authkit = authkit;
                        return authkit;
                    }, (error) => {
                        this.authkitPromise = null;
                        throw error;
                    });
            }
            return this.authkitPromise;
        }

        setWorkosAccessToken(token) {
            this.authToken = token || "";
            this.authExpiresAt = jwtExpiryMs(this.authToken);
        }

        // the token for the next request, renewed by authkit when close to
        // expiry. a session authkit cannot renew is over (signed out, and
        // the error says so); a transient failure leaves it for a retry
        async ensureWorkosToken() {
            if (!this.authkit || !this.authToken) return;
            try {
                this.setWorkosAccessToken(await this.authkit.getAccessToken());
            } catch (error) {
                if (isTransientAuthkitError(error)) {
                    const transient = new Error("Could not renew your sign-in just now. Check the connection, then retry.");
                    transient.transient = true;
                    throw transient;
                }
                this.signOut();
                throw expiredSignInError();
            }
        }

        // the sign-in button in workos mode: a redirect to workos, google
        // behind it, and back through the callback page to this page
        async startWorkosSignIn(options = {}) {
            const authkit = await this.ensureAuthKit();
            writeWorkosReturn({
                returnTo: sameOriginReturn(window.location.href, ""),
                initials: options.initials || "",
                startedAt: Date.now(),
            });
            await authkit.signIn();
        }

        // after a reload or the return from workos: a live workos session
        // gives the request token, and a sign-in just completed claims its
        // invitation first. false when there is no session to name
        async prepareWorkosSession() {
            if (!this.configured) return false;
            if (this.authToken && this.authkit?.getUser?.()) return true;
            let authkit;
            try {
                authkit = await this.ensureAuthKit();
            } catch (error) {
                this.signInError = error;
                return false;
            }
            if (!authkit.getUser()) {
                // authkit drops a refresh token workos refuses; one still
                // kept means the renewal failed in transit, and the session
                // waits for the connection
                if (workosRefreshTokenStored(this.config.workosClientId)) {
                    this.signInError = new Error("Could not reach WorkOS to renew your sign-in. Check the connection, then reload.");
                }
                this.clearAuth();
                return false;
            }
            try {
                this.setWorkosAccessToken(await authkit.getAccessToken());
            } catch (error) {
                if (isTransientAuthkitError(error)) {
                    this.signInError = new Error("Could not reach WorkOS to renew your sign-in. Check the connection, then reload.");
                    this.clearAuth();
                } else {
                    this.signOut();
                }
                return false;
            }
            const completed = takeCompletedWorkosReturn();
            if (completed) {
                try {
                    await this.claimInvite(completed.initials || "");
                } catch (error) {
                    this.endRestoreWithError(error);
                    return false;
                }
            }
            return true;
        }

        // a restore that failed. google: the kept token is dropped, as
        // before. workos: a refusal from the backend (no invitation, no
        // email claim) ends the session and is kept for the sign-in card; a
        // network failure keeps the session for the next reload
        endRestoreWithError(error) {
            if (!this.usesWorkos) {
                this.clearAuth();
                return;
            }
            if (error?.network || error?.transient) {
                this.signInError = new Error("Could not reach the project backend. Check the connection, then reload.");
                this.clearAuth();
                return;
            }
            if (!error?.authExpired) this.signInError = error;
            this.signOut();
        }

        clearAuth() {
            this.authToken = "";
            this.authExpiresAt = 0;
            this.user = null;
            this.clearAuthRefreshTimer();
            writeStoredAuthToken("");
        }

        clearAuthRefreshTimer() {
            if (this.authRefreshTimer) {
                window.clearTimeout(this.authRefreshTimer);
                this.authRefreshTimer = 0;
            }
        }

        setAuthToken(token) {
            this.authToken = token || "";
            this.authExpiresAt = jwtExpiryMs(this.authToken);
            writeStoredAuthToken(this.authToken);
            this.scheduleAuthRefresh();
        }

        scheduleAuthRefresh() {
            this.clearAuthRefreshTimer();
            if (!this.authExpiresAt) return;
            const delay = Math.max(this.authExpiresAt - Date.now() - AUTH_REFRESH_MARGIN_MS, 0);
            this.authRefreshTimer = window.setTimeout(() => {
                this.refreshAuthToken().catch(() => {
                    // The next backend request will surface the expired session
                    // with a sign-in prompt if Google cannot refresh quietly.
                });
            }, delay);
        }

        async handleCredentialResponse(response, options = this.signInOptions) {
            try {
                this.setAuthToken(response.credential || "");
                if (!this.authToken) {
                    throw new Error("Google did not return an identity token.");
                }
                await this.claimInvite(options.initials || "");
                this.user = await this.me();
                this.resolveCredentialWaiters();
                if (options.onSignedIn) {
                    await options.onSignedIn(this.user);
                }
            } catch (error) {
                this.clearAuth();
                this.rejectCredentialWaiters(error);
                if (options.onError) {
                    options.onError(error);
                }
            }
        }

        resolveCredentialWaiters() {
            const waiters = this.credentialWaiters.splice(0);
            waiters.forEach(({ resolve }) => resolve(this.user));
        }

        rejectCredentialWaiters(error) {
            const waiters = this.credentialWaiters.splice(0);
            waiters.forEach(({ reject }) => reject(error));
        }

        async refreshAuthToken() {
            if (!this.configured || !window.google?.accounts?.id || !this.authToken) {
                throw new Error("Sign in again before saving.");
            }
            if (this.authRefreshPromise) return this.authRefreshPromise;
            this.authRefreshPromise = new Promise((resolve, reject) => {
                const timeout = window.setTimeout(() => {
                    reject(new Error("Google sign-in refresh timed out. Sign in again, then retry."));
                }, AUTH_REFRESH_TIMEOUT_MS);
                this.credentialWaiters.push({
                    resolve: (user) => {
                        window.clearTimeout(timeout);
                        resolve(user);
                    },
                    reject: (error) => {
                        window.clearTimeout(timeout);
                        reject(error);
                    },
                });
                window.google.accounts.id.prompt((notification) => {
                    if (
                        notification.isNotDisplayed?.()
                        || notification.isSkippedMoment?.()
                    ) {
                        const error = new Error("Google could not refresh your sign-in. Sign in again, then retry.");
                        this.rejectCredentialWaiters(error);
                    }
                });
            }).finally(() => {
                this.authRefreshPromise = null;
            });
            return this.authRefreshPromise;
        }

        async ensureFreshToken() {
            if (
                this.authToken
                && this.authExpiresAt
                && Date.now() >= this.authExpiresAt - AUTH_REFRESH_MARGIN_MS
            ) {
                try {
                    await this.refreshAuthToken();
                } catch (error) {
                    if (Date.now() >= this.authExpiresAt) {
                        this.signOut();
                        error.authExpired = true;
                        throw error;
                    }
                }
            }
        }

        // google identity services loaded and pointed at this client; the
        // hour-end refresh (prompt) needs this even when no button renders
        async ensureGoogleInitialised() {
            if (!this.configured) return false;
            await loadScriptOnce(GSI_SCRIPT_SRC);
            if (!window.google?.accounts?.id) {
                throw new Error("Google sign-in did not initialise.");
            }
            window.google.accounts.id.initialize({
                client_id: this.config.googleClientId,
                auto_select: true,
                callback: async (response) => this.handleCredentialResponse(response),
            });
            return true;
        }

        // after a reload: the kept token names the user again, or is
        // dropped so the sign-in card shows
        async restoreSession() {
            if (this.usesWorkos && !(await this.prepareWorkosSession())) return null;
            if (!this.configured || !this.authToken) return null;
            if (this.user) return this.user;
            // the backend vouches for the kept token, so nothing waits for
            // google. its script serves only the hour-end refresh: it loads
            // in the background (measured 2026-10-01: 4 s to over 30 s from
            // accounts.google.com, which held the task load and the
            // signed-in landing behind a 2.5 s wait until 2026-10-07). a
            // refresh before it lands fails as it does when the script never
            // loads, and is retried until the token expires
            this.warmGoogle();
            try {
                let user = (await this.me()) || null;
                // a workos sign-in whose hand-off was lost (another tab
                // finished it) still claims its invitation, and binds its
                // workos identity to the row, here
                if (this.needsWorkosClaim(user)) {
                    await this.claimInvite("");
                    user = (await this.me()) || null;
                }
                this.user = user;
                if (!this.user) {
                    if (this.usesWorkos) {
                        this.endRestoreWithError(new Error("This sign-in has no project account. Ask the project lead for an invitation."));
                    } else {
                        this.clearAuth();
                    }
                }
                return this.user;
            } catch (error) {
                this.endRestoreWithError(error);
                return null;
            }
        }

        // starts google's script and initialisation without waiting for it;
        // workos mode needs no google script
        warmGoogle() {
            if (this.usesWorkos) return;
            this.ensureGoogleInitialised().catch(() => false);
        }

        // the landing in one query (tasks:raLanding): the user and the task
        // lists together. null when the deployment has no raLanding yet, so
        // the caller reads the lists the old way. a missing session reads
        // as an expired one, as the list queries would have said
        async readLanding(args) {
            if (this.raLandingUnsupported) return null;
            try {
                const landing = await this.raLanding(args);
                if (!landing?.user) {
                    this.signOut();
                    const error = new Error("Your sign-in expired. Sign in again, then retry.");
                    error.authExpired = true;
                    throw error;
                }
                return landing;
            } catch (error) {
                if (isMissingFunctionError(error)) {
                    this.raLandingUnsupported = true;
                    return null;
                }
                throw error;
            }
        }

        // after a reload with a kept token: names the user and reads the
        // landing in one round trip. landing is null when raLanding is
        // unavailable or failed for a reason the old reads will report in
        // their own words; the user is then named by users:me as before
        async restoreSessionWithLanding(args) {
            if (this.usesWorkos && !(await this.prepareWorkosSession())) return { user: null, landing: null };
            if (!this.configured || !this.authToken) return { user: null, landing: null };
            if (this.user) return { user: this.user, landing: null };
            this.warmGoogle();
            try {
                const landing = await this.readLanding(args);
                if (landing) {
                    this.user = landing.user;
                    // bind the workos identity the landing found by email
                    if (this.needsWorkosClaim(this.user)) await this.claimInvite("");
                    return { user: this.user, landing };
                }
            } catch (error) {
                if (error.authExpired || !this.authToken) return { user: null, landing: null };
            }
            return { user: await this.restoreSession(), landing: null };
        }

        // one my-work row after a write; { row } or null when raTaskRow is
        // unavailable (row itself is null for a task the caller cannot see)
        async readTaskRow(args) {
            if (this.raTaskRowUnsupported) return null;
            try {
                return { row: await this.raTaskRow(args) };
            } catch (error) {
                if (isMissingFunctionError(error)) {
                    this.raTaskRowUnsupported = true;
                    return null;
                }
                throw error;
            }
        }

        async renderSignInButton(container, options = {}) {
            if (!this.configured || !container) return;
            this.signInOptions = options;
            if (this.usesWorkos) {
                this.renderWorkosSignInButton(container, options);
                // a refusal from the last sign-in or restore, said once
                const pending = this.signInError;
                if (pending) {
                    this.signInError = null;
                    await null;
                    options.onError?.(pending);
                }
                return;
            }
            await this.ensureGoogleInitialised();
            window.google.accounts.id.renderButton(container, {
                theme: "outline",
                size: "large",
                text: "signin_with",
                // a caller that lays the button beside another (the
                // contributor portal on a phone) passes the width it has
                width: options.width || 300,
            });
        }

        // the workos sign-in button: one of the page's own buttons, so no
        // google script or frame loads. a caller's width is kept as the
        // google button's was
        renderWorkosSignInButton(container, options = {}) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "primary workos-sign-in";
            button.textContent = "Sign in with Google";
            if (options.width && button.style) {
                button.style.width = `${options.width}px`;
                button.style.maxWidth = "100%";
            }
            button.addEventListener("click", () => {
                button.disabled = true;
                this.startWorkosSignIn(options).catch((error) => {
                    button.disabled = false;
                    options.onError?.(error);
                });
            });
            container.replaceChildren(button);
        }

        async request(kind, path, args = {}) {
            if (!this.configured) {
                throw new Error("Convex is not configured for this map.");
            }
            // workos: authkit hands out the access token, renewing it when
            // close to expiry, before every request
            if (this.usesWorkos) {
                await this.ensureWorkosToken();
            } else {
                await this.ensureFreshToken();
            }
            const endpoint = kind === "query" ? "query" : kind === "action" ? "action" : "mutation";
            const headers = {
                "Content-Type": "application/json",
                "Convex-Client": "placesmap-static-workbench",
            };
            if (this.authToken) {
                headers.Authorization = `Bearer ${this.authToken}`;
            }
            let response;
            try {
                response = await fetch(`${this.config.url}/api/${endpoint}`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        path,
                        format: "convex_encoded_json",
                        args: [compactObject(args)],
                    }),
                });
            } catch (error) {
                // offline or blocked: marked, so a restore keeps the session
                error.network = true;
                throw error;
            }
            const text = await response.text();
            let payload;
            try {
                payload = text ? JSON.parse(text) : {};
            } catch (error) {
                throw new Error(text || `Convex ${kind} failed.`);
            }
            const message = payload.errorMessage || text || `Convex ${kind} failed.`;
            if (
                response.status === 401
                || /Authentication required|Unauthenticated|JWT|token/i.test(message)
            ) {
                this.signOut();
                const authError = new Error("Your sign-in expired. Sign in again, then retry.");
                authError.authExpired = true;
                throw authError;
            }
            if (!response.ok && response.status !== 560) {
                throw new Error(message);
            }
            if (payload.status === "error") {
                throw new Error(message);
            }
            return payload.value;
        }

        async me() {
            return await this.request("query", "users:me", {});
        }

        async claimInvite(initials) {
            const claimed = await this.request("mutation", "users:claimInvite", {
                initials: initials || undefined,
            });
            this.workosClaimed = this.usesWorkos;
            return claimed;
        }

        // a workos session whose row is still an invitation, or has no workos
        // identity bound yet, claims it once per page: the claim activates
        // the invitation and binds the identity (convex/users.ts)
        needsWorkosClaim(user) {
            if (!this.usesWorkos || !user || this.workosClaimed) return false;
            return user.status === "pending" || !user.workos_subject;
        }

        async listTasks(args) {
            return await this.request("query", "tasks:listTasks", args);
        }

        async listMyTasks(args) {
            return await this.request("query", "tasks:listMyTasks", args);
        }

        // the signed-in landing in one query: { user, tasks, manualTasks,
        // myWork } with slim draft and review rows; takes { countryCode,
        // batchId?, myStatuses?, limit?, includeMine? }
        async raLanding(args) {
            return await this.request("query", "tasks:raLanding", args);
        }

        // one my-work row for the after-save refresh; takes { taskId }
        async raTaskRow(args) {
            return await this.request("query", "tasks:raTaskRow", args);
        }

        async listTaskEvidence(args) {
            return await this.request("query", "evidence:listTaskEvidence", args);
        }

        async listTaskHistoricalClaims(args) {
            return await this.request("query", "historicalClaims:listTaskHistoricalClaims", args);
        }

        async getTaskEvents(args) {
            return await this.request("query", "tasks:getTaskEvents", args);
        }

        async getTaskHistory(args) {
            // role-aware provenance: events newest-first plus draft count and
            // latest review; takes { taskId, limit? }
            return await this.request("query", "tasks:getTaskHistory", args);
        }

        async listReviewQueue(args) {
            return await this.request("query", "reviews:listReviewQueue", args);
        }

        async saveEvidenceDraft(args) {
            return await this.request("mutation", "evidence:saveEvidenceDraft", args);
        }

        async submitEvidenceDraft(args) {
            return await this.request("mutation", "evidence:submitEvidenceDraft", args);
        }

        async submitEvidenceDraftWithOccupancies(args) {
            return await this.request("mutation", "evidence:submitEvidenceDraftWithOccupancies", args);
        }

        async submitUnresolvedNote(args) {
            return await this.request("mutation", "evidence:submitUnresolvedNote", args);
        }

        async reviseEvidenceDraft(args) {
            // clones the submitted draft into a new editable version and moves
            // the task changes_requested -> in_progress; takes { taskId }
            return await this.request("mutation", "evidence:reviseEvidenceDraft", args);
        }

        async skipTask(args) {
            return await this.request("mutation", "tasks:skipTask", args);
        }

        async unskipTask(args) {
            // reopens a skipped task for the assignee; takes { taskId, reason? }
            return await this.request("mutation", "tasks:unskipTask", args);
        }

        async createIssueTask(args) {
            // files an ad-hoc issue report as an open task in the country's
            // ra-issues batch; dedups onto an existing open issue for the site
            return await this.request("mutation", "tasks:createIssueTask", args);
        }

        async reopenTask(args) {
            // reopens a task for another verification pass; takes
            // { taskId, reason }. a task that is reviewed, pi_accepted or
            // exported needs a reason of at least 8 characters (trimmed) and
            // is flagged reopened_after_decision; any signed-in contributor
            // may reopen it (JB, 2026-10-15)
            return await this.request("mutation", "tasks:reopenTask", args);
        }

        async revertReopen(args) {
            // undoes a reopen made from a decided status, for review roles,
            // while nothing has been written to the task since; takes
            // { taskId, reason } with a reason of at least 8 characters
            // (JB, 2026-10-15)
            return await this.request("mutation", "tasks:revertReopen", args);
        }

        async createManualCandidateTask(args) {
            // nominates a missing place of worship as an in-progress task in
            // the country's manual batch, assigned to the nominating ra
            return await this.request("mutation", "tasks:createManualCandidateTask", args);
        }

        // --- evidence attachments: photo/document citations on a task.
        // bytes go browser -> r2 via presigned urls; convex holds metadata
        // and mints access per request (ruling 2026-08-31, review-tier only)

        async attachmentsEnabled() {
            return await this.request("query", "attachments:attachmentsEnabled", {});
        }

        async requestAttachmentUpload(args) {
            return await this.request("action", "attachments:requestAttachmentUpload", args);
        }

        async confirmAttachmentUpload(args) {
            return await this.request("mutation", "attachments:confirmAttachmentUpload", args);
        }

        async setAttachmentCaption(args) {
            return await this.request("mutation", "attachments:setAttachmentCaption", args);
        }

        async removeAttachment(args) {
            return await this.request("mutation", "attachments:removeAttachment", args);
        }

        async listTaskAttachments(args) {
            return await this.request("query", "attachments:listTaskAttachments", args);
        }

        async requestAttachmentView(args) {
            return await this.request("action", "attachments:requestAttachmentView", args);
        }

        // --- shared source register (rulings 2026-09-01): any collaborator
        // may create a source, creation is identified, visible to all

        async searchSources(args) {
            return await this.request("query", "sources:searchSources", args);
        }

        async createSource(args) {
            return await this.request("mutation", "sources:createSource", args);
        }

        async getSource(args) {
            return await this.request("query", "sources:getSource", args);
        }

        async listDraftsCitingSource(args) {
            return await this.request("query", "sources:listDraftsCitingSource", args);
        }

        async submitCurrentObservation(args) {
            // canonical multi-country route; the old vanuatu-named alias
            // stays registered server-side for previously cached clients
            return await this.request("mutation", "rapidEntry:submitCurrentObservation", args);
        }

        async withdrawEvidenceDraft(args) {
            return await this.request("mutation", "evidence:withdrawEvidenceDraft", args);
        }

        async submitHistoricalClaim(args) {
            return await this.request("mutation", "historicalClaims:submitHistoricalClaim", args);
        }

        // occupancy lane (docs/development/occupancy-build-brief-2026-09-02.md)
        async listTaskOccupancies(args) {
            return await this.request("query", "occupancies:listTaskOccupancies", args);
        }

        async listDerivedStates(args) {
            return await this.request("query", "occupancies:listDerivedStates", args);
        }

        async submitOccupancies(args) {
            return await this.request("mutation", "occupancies:submitOccupancies", args);
        }

        async decideDerivedYear(args) {
            return await this.request("mutation", "occupancies:decideDerivedYear", args);
        }

        async confirmAllDerived(args) {
            return await this.request("mutation", "occupancies:confirmAllDerived", args);
        }

        // the snapshot the decision form shows and submits (pi ruling
        // 2026-09-11): args are { taskId, evidenceDraftId }
        async getReviewSnapshot(args) {
            return await this.request("query", "reviews:getReviewSnapshot", args);
        }

        // args may carry snapshotHash; the request forwards every field, so
        // the snapshot pin reaches the server exactly as the form set it
        async recordReviewDecision(args) {
            return await this.request("mutation", "reviews:recordReviewDecision", args);
        }

        // the pi acceptance layer (jb 2026-09-04): only a principal
        // investigator ratifies a reviewer's acceptance into the backend
        async recordAcceptance(args) {
            return await this.request("mutation", "acceptances:recordAcceptance", args);
        }

        async listTaskAcceptances(args) {
            return await this.request("query", "acceptances:listTaskAcceptances", args);
        }

        async listPrincipalInvestigators() {
            return await this.request("query", "acceptances:listPrincipalInvestigators", {});
        }

        // recorded agent judgments about the place a task is about, each
        // with its newest dispositions embedded (convex/agentJudgments.ts)
        async listJudgmentsForTaskPlace(args) {
            return await this.request("query", "agentJudgments:listJudgmentsForTaskPlace", args);
        }

        // appends one disposition row; the judgment, task and decision are
        // untouched
        async recordJudgmentDisposition(args) {
            return await this.request("mutation", "agentJudgments:recordJudgmentDisposition", args);
        }

        async claimReviewTask(args) {
            return await this.request("mutation", "reviews:claimReviewTask", args);
        }

        async releaseReviewTask(args) {
            return await this.request("mutation", "reviews:releaseReviewTask", args);
        }

        async requestAdditionalOpinion(args) {
            return await this.request("mutation", "reviews:requestAdditionalOpinion", args);
        }

        async requestContributorComment(args) {
            return await this.request("mutation", "reviews:requestContributorComment", args);
        }

        async respondToReviewerComment(args) {
            return await this.request("mutation", "tasks:respondToReviewerComment", args);
        }
    }

    // the callback page (auth-callback.html): authkit exchanges the code
    // workos returned, keeping the refresh token on the device; the hand-off
    // is marked complete for the portal's claimInvite, and the tab returns
    // to the page that started the sign-in. a failed exchange stays on the
    // callback page with a link back
    PowConvexTaskClient.completeWorkosCallback = async function (config, report = () => {}) {
        const settings = normaliseConfig(config);
        const handOff = readWorkosReturn();
        const back = sameOriginReturn(handOff?.returnTo, "verification.html");
        if (!settings.workosClientId) {
            report("WorkOS sign-in is not switched on for this site.", back);
            return false;
        }
        let exchanged = false;
        try {
            await workosLibrary().createClient(settings.workosClientId, {
                devMode: true,
                redirectUri: `${window.location.origin}${window.location.pathname}`,
                onRedirectCallback: () => {
                    exchanged = true;
                },
            });
        } catch (error) {
            exchanged = false;
        }
        if (!exchanged) {
            writeWorkosReturn(null);
            report("Sign-in did not complete. Go back and sign in again.", back);
            return false;
        }
        writeWorkosReturn({ ...(handOff || {}), signedInAt: Date.now() });
        window.location.replace(back);
        return true;
    };

    window.PowConvexTaskClient = PowConvexTaskClient;
})();
