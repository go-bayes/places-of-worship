(function () {
    const DEFAULT_CONFIG = {
        enabled: false,
        url: "",
        googleClientId: "",
        countryCode: "NZ",
    };

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

    class PowConvexTaskClient {
        constructor(config) {
            this.config = normaliseConfig(config);
            this.authToken = "";
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
            this.user = null;
            if (window.google?.accounts?.id?.disableAutoSelect) {
                window.google.accounts.id.disableAutoSelect();
            }
        }

        async renderSignInButton(container, options = {}) {
            if (!this.configured || !container) return;
            await loadScriptOnce("https://accounts.google.com/gsi/client");
            if (!window.google?.accounts?.id) {
                throw new Error("Google sign-in did not initialise.");
            }
            window.google.accounts.id.initialize({
                client_id: this.config.googleClientId,
                callback: async (response) => {
                    try {
                        this.authToken = response.credential || "";
                        if (!this.authToken) {
                            throw new Error("Google did not return an identity token.");
                        }
                        await this.claimInvite(options.initials || "");
                        this.user = await this.me();
                        if (options.onSignedIn) {
                            await options.onSignedIn(this.user);
                        }
                    } catch (error) {
                        this.authToken = "";
                        this.user = null;
                        if (options.onError) {
                            options.onError(error);
                        }
                    }
                },
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
            const endpoint = kind === "query" ? "query" : "mutation";
            const headers = {
                "Content-Type": "application/json",
                "Convex-Client": "placesmap-static-map",
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
            if (!response.ok && response.status !== 560) {
                throw new Error(payload.errorMessage || text || `Convex ${kind} failed.`);
            }
            if (payload.status === "error") {
                throw new Error(payload.errorMessage || `Convex ${kind} failed.`);
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

        async saveEvidenceDraft(args) {
            return await this.request("mutation", "evidence:saveEvidenceDraft", args);
        }

        async submitEvidenceDraft(args) {
            return await this.request("mutation", "evidence:submitEvidenceDraft", args);
        }

        async skipTask(args) {
            return await this.request("mutation", "tasks:skipTask", args);
        }
    }

    window.PowConvexTaskClient = PowConvexTaskClient;
})();
