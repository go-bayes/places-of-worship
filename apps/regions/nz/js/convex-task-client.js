(function () {
    const DEFAULT_CONFIG = {
        enabled: false,
        url: "",
        clerkPublishableKey: "",
        // set only while existing google members are being moved to clerk
        // (r-c18): the public google client id for the confirmation step
        googleMigrationClientId: "",
        countryCode: "NZ",
    };
    // clerk sessions (contributor-access brief 4.4): clerk keeps the person
    // signed in (seven days, refreshed silently) and mints a short-lived
    // convex token per request from the "convex" jwt template. nothing of
    // ours holds a token; the google-era copy on the device is removed
    const CLERK_JWT_TEMPLATE = "convex";
    const CLERK_JS_MAJOR = "6";
    const CLERK_UI_MAJOR = "1";
    const LEGACY_AUTH_STORAGE_KEY = "powConvexAuth:v1";
    const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
    const MIGRATION_NEEDED = /Confirm that Google account first/i;
    // a sign-out clerk has not confirmed, by session id: a reload retries it
    // rather than restoring the session (shared devices)
    const SIGN_OUT_PENDING_KEY = "powSignOutPending:v1";
    const SIGN_OUT_FAILED = "Sign-out did not finish, so this browser may still be signed in. Try again before you leave the device.";
    // the clerk frontend api hosts this project loads scripts from; a key
    // naming any other host is refused. add the production instance's host
    // (for example clerk.religionmap.org) when it is activated
    const CLERK_FRONTEND_API_HOSTS = ["sure-lizard-50.clerk.accounts.dev"];
    const NO_ACCESS_HELP = "This address has no project access yet. Sign out and use the invited address, or ask the project lead to invite this one.";
    // the claimInvite refusals a person can act on (brief 4.3.2)
    const ACCESS_REFUSED = /No pending project invitation|Verify this email address|bound to another sign-in method|requires a verified email|Confirm that Google account first/i;
    const scriptLoads = new Map();

    // convex wraps a thrown error as "[Request ID: …] Server Error Uncaught
    // Error: <message> at handler (…)"; the card shows only the message
    function serverMessage(error) {
        const raw = String(error?.message || "Could not sign in to the project.");
        const match = raw.match(/Uncaught Error:\s*([\s\S]*?)(?:\s+at\s+\S+\s+\(|$)/);
        return (match ? match[1] : raw).trim();
    }

    function normaliseConfig(config) {
        return { ...DEFAULT_CONFIG, ...(config || {}) };
    }

    function compactObject(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entry]) => entry !== undefined && entry !== ""),
        );
    }

    function escapeText(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
        })[char]);
    }

    // a publishable key is pk_test_ or pk_live_ and the base64 of the
    // instance's frontend api host followed by "$". the host must be one
    // this project approved, since clerk's scripts load from it
    function clerkFrontendApi(publishableKey) {
        const match = /^pk_(test|live)_([A-Za-z0-9+/]+={0,2})$/.exec(String(publishableKey || ""));
        if (!match) return "";
        try {
            const decoded = atob(match[2]);
            if (!decoded.endsWith("$") || decoded.indexOf("$") !== decoded.length - 1) return "";
            const host = decoded.slice(0, -1).toLowerCase();
            return CLERK_FRONTEND_API_HOSTS.includes(host) ? host : "";
        } catch (error) {
            return "";
        }
    }

    function readPendingSignOut() {
        try {
            return window.localStorage?.getItem(SIGN_OUT_PENDING_KEY) || "";
        } catch (error) {
            return "";
        }
    }

    function writePendingSignOut(sessionId) {
        try {
            if (sessionId) window.localStorage?.setItem(SIGN_OUT_PENDING_KEY, sessionId);
            else window.localStorage?.removeItem(SIGN_OUT_PENDING_KEY);
        } catch (error) {
            // blocked storage: the retry lives in this page only
        }
    }

    // clerk's bundles are loaded as cors scripts; google's gsi client is not
    // served with cors headers, so it loads as a plain script
    function loadScriptOnce(src, attributes = {}, { cors = true } = {}) {
        if (scriptLoads.has(src)) return scriptLoads.get(src);
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            return Promise.resolve();
        }
        const load = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            if (cors) script.crossOrigin = "anonymous";
            Object.entries(attributes).forEach(([name, value]) => script.setAttribute?.(name, value));
            script.onload = () => resolve();
            script.onerror = () => {
                scriptLoads.delete(src);
                script.remove?.();
                reject(new Error(`Could not load ${src}`));
            };
            document.head.appendChild(script);
        });
        scriptLoads.set(src, load);
        return load;
    }

    // clerk's session cookie on this site: __client_uat (and a suffixed
    // twin) holds the time of the last sign-in, or 0 once signed out. it
    // lets a reload name the user before the page paints without loading
    // clerk for someone who was never signed in
    function sessionCookieHint() {
        try {
            return String(document.cookie || "")
                .split(";")
                .map((part) => part.trim())
                .some((part) => /^__client_uat(_[^=]*)?=/.test(part) && Number(part.split("=")[1]) > 0);
        } catch (error) {
            return false;
        }
    }

    function removeLegacyToken() {
        try {
            window.localStorage?.removeItem(LEGACY_AUTH_STORAGE_KEY);
        } catch (error) {
            // blocked storage: nothing to remove
        }
    }

    // the portal's own tokens, so the clerk card reads as part of the dark
    // page (docs/ui-style-guide.md, theme table)
    function themeToken(name, fallback) {
        try {
            const value = window.getComputedStyle?.(document.documentElement)?.getPropertyValue(name)?.trim();
            return value || fallback;
        } catch (error) {
            return fallback;
        }
    }

    function clerkAppearance() {
        return {
            variables: {
                colorBackground: themeToken("--panel", "#17202a"),
                colorForeground: themeToken("--ink", "#e8edf3"),
                colorMutedForeground: themeToken("--muted", "#a7b3c2"),
                colorPrimary: themeToken("--action", "#7fb3e6"),
                colorPrimaryForeground: themeToken("--panel", "#17202a"),
                colorInput: themeToken("--panel-2", "#1e2a36"),
                colorInputForeground: themeToken("--ink", "#e8edf3"),
                colorBorder: themeToken("--control-line", "#5b6b7d"),
                colorNeutral: themeToken("--ink", "#e8edf3"),
                colorDanger: themeToken("--danger", "#f28b82"),
                colorRing: themeToken("--action", "#7fb3e6"),
                fontFamily: "inherit",
                fontFamilyButtons: "inherit",
                fontSize: "1rem",
                borderRadius: "6px",
            },
            elements: {
                // the card's frame is ours; clerk's header stays, since its
                // later steps name the address a code went to
                rootBox: { width: "100%" },
                cardBox: { width: "100%", boxShadow: "none", border: "none" },
                card: { boxShadow: "none", border: "none", padding: "0", background: "transparent" },
                headerTitle: { fontSize: "1rem" },
                // 44 px targets on a first-time contributor's path (r-u6)
                socialButtonsBlockButton: {
                    minHeight: "44px",
                    backgroundColor: themeToken("--panel-2", "#1e2a36"),
                    boxShadow: `0 0 0 1px ${themeToken("--control-line", "#5b6b7d")}`,
                    color: themeToken("--ink", "#e8edf3"),
                },
                socialButtonsBlockButtonText: { color: themeToken("--ink", "#e8edf3"), fontWeight: "600" },
                formButtonPrimary: { minHeight: "44px", width: "100%", fontSize: "1rem" },
                otpCodeFieldInput: { minHeight: "44px", boxShadow: `0 0 0 1px ${themeToken("--control-line", "#5b6b7d")}` },
                formFieldInput: { minHeight: "44px", fontSize: "1rem", boxShadow: `0 0 0 1px ${themeToken("--control-line", "#5b6b7d")}` },
                formResendCodeLink: { minHeight: "40px" },
                footerActionLink: { minHeight: "40px", display: "inline-flex", alignItems: "center" },
            },
        };
    }

    class PowConvexTaskClient {
        constructor(config) {
            this.config = normaliseConfig(config);
            this.user = null;
            this.clerk = null;
            this.clerkLoad = null;
            this.sessionId = "";
            this.signInOptions = {};
            this.signInHost = null;
            this.signInNode = null;
            this.completion = null;
            this.signOutPromise = null;
            this.signOutFailure = null;
            // lifecycle callbacks the page registers once, whether the user
            // came back through restoreSession or the sign-in card
            this.lifecycle = {};
            // the session whose claim the backend refused, and why: the card
            // then says so rather than asking again on every render
            this.claimFailure = null;
            removeLegacyToken();
        }

        // onSignedOut({ deliberate }): the session ended, in another tab, by
        // expiry, or by a sign-out this client completed
        setLifecycle(handlers = {}) {
            this.lifecycle = { ...handlers };
        }

        get configured() {
            return Boolean(this.config.enabled && this.config.url && this.clerkFrontendApi);
        }

        get clerkFrontendApi() {
            return clerkFrontendApi(this.config.clerkPublishableKey);
        }

        get signedIn() {
            return Boolean(this.user && this.sessionId);
        }

        // whether a reload may find a clerk session worth restoring
        get mayHaveSession() {
            return Boolean(this.configured && (this.sessionId || sessionCookieHint()));
        }

        // the move of google members to clerk is open on this page
        get migrationOpen() {
            return Boolean(this.configured && this.config.googleMigrationClientId);
        }

        // the address clerk verified for this session, shown on the card
        get accountEmail() {
            return this.clerk?.user?.primaryEmailAddress?.emailAddress || "";
        }

        async ensureClerkLoaded() {
            if (!this.configured) return null;
            if (this.clerkLoad) return this.clerkLoad;
            this.clerkLoad = (async () => {
                const host = this.clerkFrontendApi;
                await loadScriptOnce(`https://${host}/npm/@clerk/ui@${CLERK_UI_MAJOR}/dist/ui.browser.js`);
                await loadScriptOnce(`https://${host}/npm/@clerk/clerk-js@${CLERK_JS_MAJOR}/dist/clerk.browser.js`, {
                    "data-clerk-publishable-key": this.config.clerkPublishableKey,
                });
                const clerk = window.Clerk;
                if (!clerk || typeof clerk.load !== "function") {
                    throw new Error("Sign-in did not initialise. Reload the page, then try again.");
                }
                await clerk.load({
                    ui: { ClerkUI: window.__internal_ClerkUICtor },
                    appearance: clerkAppearance(),
                    // clerk navigates after sign-in and sign-out; the portal
                    // stays on its own page so typed work is never reloaded
                    routerPush: (to) => this.navigate(to),
                    routerReplace: (to) => this.navigate(to),
                });
                this.clerk = clerk;
                this.sessionId = clerk.session?.id || "";
                clerk.addListener((resources) => this.onClerkChange(resources));
                return clerk;
            })();
            this.clerkLoad.catch(() => {
                this.clerkLoad = null;
            });
            return this.clerkLoad;
        }

        navigate(to) {
            try {
                const target = new URL(to, window.location.href);
                if (target.origin === window.location.origin && target.pathname === window.location.pathname) {
                    return;
                }
                window.location.assign(target.href);
            } catch (error) {
                // an unreadable target: stay on the page
            }
        }

        // clerk reports every session change here: a sign-in finished in
        // the card, a sign-out in another tab, a session that ended
        onClerkChange(resources) {
            const nextSessionId = resources?.session?.id || "";
            // a deliberate sign-out owns the session state until clerk
            // confirms it (its confirming reload may report changes)
            if (this.signOutPromise) return;
            if (nextSessionId === this.sessionId) return;
            const hadSession = Boolean(this.sessionId);
            this.sessionId = nextSessionId;
            this.user = null;
            this.claimFailure = null;
            this.releaseSignInElement();
            if (!nextSessionId) {
                if (hadSession) this.lifecycle.onSignedOut?.({ deliberate: false });
                return;
            }
            if (this.signInHost) {
                this.signInHost.innerHTML = `<p class="pow-account-note">Checking project access…</p>`;
                this.completeSignIn(this.signInOptions).catch(() => {});
            }
        }

        // a clerk session becomes a project user: claimInvite activates an
        // invitation or re-keys an existing member (brief 4.3.2), then me
        // names the row. one attempt per session at a time
        async completeSignIn(options = this.signInOptions) {
            const sessionId = this.sessionId;
            if (!sessionId) return null;
            if (this.completion?.sessionId === sessionId) return this.completion.promise;
            const promise = (async () => {
                let user;
                try {
                    await this.claimInvite(options.initials || "");
                    user = await this.me();
                    if (!user) throw new Error("No pending project invitation found for this email.");
                } catch (error) {
                    const message = serverMessage(error);
                    if (this.sessionId === sessionId) {
                        this.user = null;
                        this.claimFailure = { sessionId, message };
                    }
                    // the backend refused this address: the card says so
                    // itself; anything else (a network fault) goes to the page
                    if (ACCESS_REFUSED.test(message)) {
                        error.accessRefused = true;
                        if (this.signInHost && this.sessionId === sessionId) this.renderAccountNote(this.signInHost);
                    } else if (options.onError) {
                        options.onError(error);
                    }
                    throw error;
                } finally {
                    if (this.completion?.sessionId === sessionId) this.completion = null;
                }
                if (this.sessionId !== sessionId) return null;
                this.user = user;
                this.claimFailure = null;
                if (options.onSignedIn) await options.onSignedIn(user);
                return user;
            })();
            this.completion = { sessionId, promise };
            return promise;
        }

        // deliberate: the sign-out button, which ends the clerk session and
        // resolves only once clerk confirms it; a refusal rejects, the card
        // then offers the retry and a reload retries before restoring.
        // otherwise only the project user is forgotten, and the card asks
        // the backend again with the session clerk still holds
        signOut({ deliberate = false } = {}) {
            this.user = null;
            this.claimFailure = null;
            if (!deliberate) return Promise.resolve();
            if (this.signOutPromise) return this.signOutPromise;
            const clerk = this.clerk;
            const sessionId = this.sessionId || clerk?.session?.id || "";
            // the page may repaint its card at once; the card waits for this
            // so it never re-admits the session being ended
            this.sessionId = "";
            this.signOutFailure = null;
            this.releaseSignInElement();
            if (sessionId) writePendingSignOut(sessionId);
            this.signOutPromise = (async () => {
                if (!clerk || !sessionId) {
                    writePendingSignOut("");
                    return;
                }
                try {
                    await clerk.signOut({ redirectUrl: window.location.href });
                    // clerk resolves even when the revocation never reached
                    // its server (it swallows network_error); only the
                    // server's own list of this browser's sessions confirms it
                    if (!(await this.confirmSignedOut(clerk, sessionId))) {
                        throw new Error("sign-out unconfirmed");
                    }
                } catch (error) {
                    // clerk drops its local copy of the session even when the
                    // server refuses to end it (seen 2026-09-24 with a 422)
                    // or never hears of it (an aborted request), and a reload
                    // would bring the session back; so any refusal or
                    // unconfirmed revocation is a failure, whatever
                    // clerk.session says now
                    this.sessionId = clerk.session?.id || sessionId;
                    this.signOutFailure = { sessionId: this.sessionId };
                    const failure = new Error(SIGN_OUT_FAILED);
                    failure.signOutFailed = true;
                    throw failure;
                }
                writePendingSignOut("");
            })().finally(() => {
                this.signOutPromise = null;
            });
            return this.signOutPromise;
        }

        // the server's view after a sign-out: clerk.client.reload() fetches
        // this browser's sessions; the ended one must not be live. a reload
        // that fails (offline) confirms nothing
        async confirmSignedOut(clerk, sessionId) {
            try {
                const client = await clerk.client?.reload?.();
                if (!client) return false;
                return !(client.sessions || []).some((session) => session?.id === sessionId
                    && (session.status === "active" || session.status === "pending"));
            } catch (error) {
                return false;
            }
        }

        // after a reload: a live clerk session names the user again, else
        // null so the sign-in card shows
        async restoreSession() {
            if (!this.configured) return null;
            if (this.user) return this.user;
            try {
                await this.ensureClerkLoaded();
                if (!this.sessionId) return null;
                // a sign-out that never finished is finished first, never
                // silently undone by a reload
                if (readPendingSignOut() === this.sessionId) {
                    await this.signOut({ deliberate: true }).catch(() => {});
                    return null;
                }
                return await this.completeSignIn({ ...this.signInOptions, onSignedIn: undefined, onError: undefined });
            } catch (error) {
                return null;
            }
        }

        // the sign-in card: clerk's sign-in (google or an email code) when
        // nobody is signed in; the account and a sign-out button when a
        // session exists that the project has not admitted
        async renderSignInButton(container, options = {}) {
            if (!this.configured || !container) return;
            this.signInOptions = options;
            this.signInHost = container;
            let clerk;
            try {
                clerk = await this.ensureClerkLoaded();
            } catch (error) {
                // a slow or blocked network: say so in the card and offer a
                // retry, rather than failing back to the page, which would
                // repaint the card and ask again at once
                if (this.signInHost === container) this.renderLoadFailure(container, options);
                return;
            }
            if (this.signOutPromise) await this.signOutPromise.catch(() => {});
            // the page repaints its card often; only the newest host counts
            if (this.signInHost !== container) return;
            if (!this.sessionId) {
                container.replaceChildren(this.signInElement(clerk));
                return;
            }
            if (this.user) return;
            if (this.signOutFailure?.sessionId === this.sessionId || readPendingSignOut() === this.sessionId) {
                this.renderSignOutFailure(container);
                return;
            }
            if (this.claimFailure?.sessionId !== this.sessionId) {
                container.innerHTML = `<p class="pow-account-note">Checking project access…</p>`;
                try {
                    await this.completeSignIn(options);
                    return;
                } catch (error) {
                    // a refusal the card explains was drawn by completeSignIn
                    if (error.accessRefused && this.signInHost === container) return;
                    // anything else falls through to the account note below
                }
            }
            if (this.signInHost !== container || this.user) return;
            this.renderAccountNote(container);
        }

        // clerk's sign-in lives in one element for a whole signed-out spell
        // and moves between the page's repainted cards, so a half-typed
        // address or code survives a repaint. a new spell gets a fresh form
        signInElement(clerk) {
            if (!this.signInNode) {
                this.signInNode = document.createElement("div");
                this.signInNode.className = "clerk-sign-in-mount";
                clerk.mountSignIn(this.signInNode, {
                    appearance: clerkAppearance(),
                    withSignUp: true,
                    forceRedirectUrl: window.location.href,
                    signUpForceRedirectUrl: window.location.href,
                });
            }
            return this.signInNode;
        }

        releaseSignInElement() {
            if (!this.signInNode) return;
            try {
                this.clerk?.unmountSignIn(this.signInNode);
            } catch (error) {
                // already gone with its page
            }
            this.signInNode = null;
        }

        renderLoadFailure(container, options) {
            container.innerHTML = `
                <div class="pow-account-note" role="alert">
                    <span>Sign-in could not load. Check the connection, then try again.</span>
                    <button type="button" data-pow-retry>Try again</button>
                </div>
            `;
            container.querySelector("[data-pow-retry]")?.addEventListener("click", () => {
                this.renderSignInButton(container, options);
            });
        }

        renderAccountNote(container) {
            const failure = this.claimFailure?.message || "";
            if (this.migrationOpen && MIGRATION_NEEDED.test(failure)) {
                this.renderMigrationStep(container);
                return;
            }
            const noInvitation = /No pending project invitation/i.test(failure);
            container.innerHTML = `
                <div class="pow-account-note" role="status">
                    <span>Signed in as <strong>${escapeText(this.accountEmail || "this account")}</strong></span>
                    <span>${escapeText(noInvitation ? NO_ACCESS_HELP : failure)}</span>
                    <button type="button" data-pow-sign-out>Sign out</button>
                </div>
            `;
            container.querySelector("[data-pow-sign-out]")?.addEventListener("click", () => this.retrySignOut(container));
        }

        // r-c18 (jb 2026-09-24, option 1), bound on the server: signed in to
        // clerk but not yet admitted, the member confirms the google account
        // they used before. the clerk sign-in requests a pairing, the google
        // sign-in approves exactly that pairing, and the claim is retried;
        // the nonce lives only inside this one flow
        renderMigrationStep(container) {
            container.innerHTML = `
                <div class="pow-account-note pow-migration-step" role="status">
                    <strong class="inline">Confirm your existing account for the new sign-in</strong>
                    <span>Signed in as <strong class="inline">${escapeText(this.accountEmail || "this account")}</strong>.</span>
                    <span>This address belongs to a project member who used Google sign-in before. Continue with that Google account once, and your roles and work move to the new sign-in.</span>
                    <div class="pow-google-confirm" data-pow-google-confirm></div>
                    <span class="pow-migration-status" data-pow-migration-status aria-live="polite"></span>
                    <button type="button" data-pow-sign-out>Sign out</button>
                </div>
            `;
            container.querySelector("[data-pow-sign-out]")?.addEventListener("click", () => this.retrySignOut(container));
            this.mountGoogleConfirm(container);
        }

        async mountGoogleConfirm(container) {
            const host = container.querySelector?.("[data-pow-google-confirm]");
            const status = container.querySelector?.("[data-pow-migration-status]");
            if (!host || !this.migrationOpen || !this.sessionId) return;
            // the clerk session this step belongs to; a click that lands after
            // it ended or changed does nothing
            const sessionId = this.sessionId;
            try {
                await loadScriptOnce(GSI_SCRIPT_SRC, {}, { cors: false });
                const google = window.google?.accounts?.id;
                if (!google) throw new Error("Google sign-in did not load.");
                google.initialize({
                    client_id: this.config.googleMigrationClientId,
                    auto_select: false,
                    callback: (response) => this.confirmExistingAccount(sessionId, response?.credential || "", container, status),
                });
                host.innerHTML = "";
                google.renderButton(host, { theme: "filled_black", size: "large", text: "continue_with", width: 300 });
            } catch (error) {
                if (status) status.textContent = "Google sign-in could not load. Check the connection, then try again.";
            }
        }

        async confirmExistingAccount(sessionId, googleCredential, container, status) {
            const current = () => Boolean(sessionId) && this.sessionId === sessionId;
            if (!current()) return false;
            if (status) status.textContent = "Confirming…";
            try {
                // 1. the clerk sign-in asks; the server binds the pairing to it
                const { nonce } = await this.request("mutation", "users:requestIdentityMigration", {});
                if (!current()) return false;
                // 2. the google sign-in approves that pairing, and only that
                await this.request("mutation", "users:approveIdentityMigration", { nonce }, { overrideToken: googleCredential });
                if (!current()) return false;
            } catch (error) {
                if (current() && status) status.textContent = serverMessage(error);
                return false;
            }
            // 3. the clerk sign-in claims; the server spends the pairing
            if (status) status.textContent = "Confirmed. Moving your account…";
            this.claimFailure = null;
            await this.renderSignInButton(container, this.signInOptions);
            return true;
        }

        renderSignOutFailure(container) {
            container.innerHTML = `
                <div class="pow-account-note" role="alert">
                    <span>${escapeText(SIGN_OUT_FAILED)}</span>
                    <button type="button" data-pow-sign-out>Try sign-out again</button>
                </div>
            `;
            container.querySelector("[data-pow-sign-out]")?.addEventListener("click", () => this.retrySignOut(container));
        }

        async retrySignOut(container) {
            try {
                await this.signOut({ deliberate: true });
            } catch (error) {
                if (this.signInHost === container) this.renderSignOutFailure(container);
                return;
            }
            this.lifecycle.onSignedOut?.({ deliberate: true });
        }

        // a fresh short-lived convex token per request; clerk caches it for
        // about its sixty-second life and refreshes the session silently
        async getToken() {
            if (!this.sessionId || !this.clerk?.session) return "";
            try {
                return (await this.clerk.session.getToken({ template: CLERK_JWT_TEMPLATE })) || "";
            } catch (error) {
                return "";
            }
        }

        // overrideToken: a google id token for the one r-c18 call that must
        // be made as the member's google sign-in, never stored
        async request(kind, path, args = {}, { overrideToken = "" } = {}) {
            if (!this.configured) {
                throw new Error("Convex is not configured for this map.");
            }
            const token = overrideToken || await this.getToken();
            const endpoint = kind === "query" ? "query" : kind === "action" ? "action" : "mutation";
            const headers = {
                "Content-Type": "application/json",
                "Convex-Client": "placesmap-static-workbench",
            };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
            const response = await fetch(`${this.config.url}/api/${endpoint}`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    path,
                    format: "convex_encoded_json",
                    args: [compactObject(args)],
                }),
            });
            const text = await response.text();
            let payload;
            try {
                payload = text ? JSON.parse(text) : {};
            } catch (error) {
                throw new Error(text || `Convex ${kind} failed.`);
            }
            const message = payload.errorMessage || text || `Convex ${kind} failed.`;
            if (
                !overrideToken
                && (response.status === 401 || /Authentication required|Unauthenticated|JWT|token/i.test(message))
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
            return await this.request("mutation", "users:claimInvite", {
                initials: initials || undefined,
            });
        }

        async listTasks(args) {
            return await this.request("query", "tasks:listTasks", args);
        }

        async listMyTasks(args) {
            return await this.request("query", "tasks:listMyTasks", args);
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
            // reopens a task that is under review or provisionally/closed
            // pending review for another verification pass; takes
            // { taskId, reason }
            return await this.request("mutation", "tasks:reopenTask", args);
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

    window.PowConvexTaskClient = PowConvexTaskClient;
})();
