(function () {
    const DEFAULT_CONFIG = {
        enabled: false,
        url: "",
        googleClientId: "",
        countryCode: "NZ",
    };
    const AUTH_REFRESH_MARGIN_MS = 5 * 60 * 1000;
    const AUTH_REFRESH_TIMEOUT_MS = 30 * 1000;

    function normaliseConfig(config) {
        return { ...DEFAULT_CONFIG, ...(config || {}) };
    }

    function loadScriptOnce(src) {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Could not load ${src}`));
            document.head.appendChild(script);
        });
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
        }

        get configured() {
            return Boolean(this.config.enabled && this.config.url && this.config.googleClientId);
        }

        get signedIn() {
            return Boolean(this.authToken && this.user);
        }

        signOut() {
            this.authToken = "";
            this.authExpiresAt = 0;
            this.user = null;
            this.clearAuthRefreshTimer();
            if (window.google?.accounts?.id?.disableAutoSelect) {
                window.google.accounts.id.disableAutoSelect();
            }
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
                this.authToken = "";
                this.authExpiresAt = 0;
                this.user = null;
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

        async renderSignInButton(container, options = {}) {
            if (!this.configured || !container) return;
            await loadScriptOnce("https://accounts.google.com/gsi/client");
            if (!window.google?.accounts?.id) {
                throw new Error("Google sign-in did not initialise.");
            }
            this.signInOptions = options;
            window.google.accounts.id.initialize({
                client_id: this.config.googleClientId,
                auto_select: true,
                callback: async (response) => this.handleCredentialResponse(response),
            });
            window.google.accounts.id.renderButton(container, {
                theme: "outline",
                size: "large",
                text: "signin_with",
                width: 300,
            });
        }

        async request(kind, path, args = {}) {
            if (!this.configured) {
                throw new Error("Convex is not configured for this map.");
            }
            await this.ensureFreshToken();
            const endpoint = kind === "query" ? "query" : "mutation";
            const headers = {
                "Content-Type": "application/json",
                "Convex-Client": "placesmap-static-workbench",
            };
            if (this.authToken) {
                headers.Authorization = `Bearer ${this.authToken}`;
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

        async submitVanuatuCurrentObservation(args) {
            return await this.request("mutation", "rapidEntry:submitVanuatuCurrentObservation", args);
        }

        async recordReviewDecision(args) {
            return await this.request("mutation", "reviews:recordReviewDecision", args);
        }
    }

    window.PowConvexTaskClient = PowConvexTaskClient;
})();
