/**
 * auth.js
 * Handles User Authentication and Cloud Storage Sync via Google Apps Script
 */

const AuthService = {
    // --- Configuration ---
    // REPLACE THIS URL with your deployed Web App URL from Google Apps Script
    API_URL: "https://script.google.com/macros/s/AKfycbxJ8kErWASEdUp1tvgl3fnsK_eFG-bhpUB7tcGMBcCw7619tMMeEBqe1gkM3hTwV68-/exec",

    // --- State ---
    currentUser: null,
    isLoggedIn: false,

    // --- Core Methods ---

    /**
     * Set the API URL dynamically (e.g. from UI input)
     */
    setApiUrl(url) {
        let cleanUrl = url.trim();
        // Remove trailing / if exists
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }
        // Basic validation warning (console only) if it doesn't look like a GAS Web App
        if (!cleanUrl.includes('script.google.com')) {
            console.warn("URL does not look like a Google Apps Script URL");
        }
        this.API_URL = cleanUrl;
        localStorage.setItem('gas_api_url', this.API_URL);
    },

    getApiUrl() {
        if (!this.API_URL) {
            this.API_URL = localStorage.getItem('gas_api_url') || "https://script.google.com/macros/s/AKfycbxdQ4S27jNlxbVySX9XIKyo-lwOsC-zOswVfIP8k73qrF4I7hbme1HYO9410-tCRq4suw/exec";
        }
        return this.API_URL;
    },

    /**
     * Helper to perform API Request using "CORS-Safe" POST
     * Strategy: Use 'text/plain' Content-Type to avoid CORS Preflight (OPTIONS) check.
     * The backend (GAS) will parse the JSON string from the body.
     */
    async _request(params) {
        const url = this.getApiUrl();
        if (!url) return { success: false, message: "Vui lòng nhập URL API Google Script trước!" };

        // Validate URL format
        if (!url.endsWith('/exec')) {
            alert("URL sai! Phải kết thúc bằng /exec");
            return { success: false, message: "URL sai." };
        }

        try {
            // OPTION 5: "text/plain" workaround to skip CORS Preflight
            const response = await fetch(url, {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    // key trick: text/plain prevents the browser from sending an OPTIONS request
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(params)
            });

            const text = await response.text();

            // Check for HTML response (Deployment Error)
            if (text.trim().startsWith('<')) {
                console.error("HTML Resp:", text);
                throw new Error("API lỗi (HTML). Có thể do chưa Deploy 'Anyone' hoặc URL sai.");
            }

            try {
                return JSON.parse(text);
            } catch (e) {
                throw new Error("Dữ liệu lỗi: " + text.substring(0, 50));
            }

        } catch (error) {
            console.error("Fetch Error:", error);

            // Helpful Tip for "Failed to fetch"
            if (error.message.includes("Failed to fetch")) {
                alert("Lỗi kết nối (CORS)! \n\n1. Hãy chắc chắn bạn đã Deploy chọn 'Anyone'.\n2. Nếu chạy file index.html trực tiếp, hãy thử cài 'Live Server' trên VSCode để chạy localhost.");
            } else {
                alert("Lỗi kết nối: " + error.message);
            }

            return { success: false, message: error.message };
        }
    },

    /**
     * Register a new user
     */
    async register(username, password) {
        return this._request({
            action: 'register',
            username: username,
            password: password
        });
    },

    /**
     * Login existing user
     */
    async login(username, password) {
        const result = await this._request({
            action: 'login',
            username: username,
            password: password
        });

        if (result.success) {
            this.currentUser = { username, password };
            this.isLoggedIn = true;
            localStorage.setItem('current_user', JSON.stringify(this.currentUser));
        }
        return result;
    },

    /**
     * Logout
     */
    logout() {
        this.currentUser = null;
        this.isLoggedIn = false;
        localStorage.removeItem('current_user');
        window.location.reload();
    },

    /**
     * Load Check (Auto Login if valid session persists)
     */
    checkSession() {
        const stored = localStorage.getItem('current_user');
        if (stored) {
            try {
                this.currentUser = JSON.parse(stored);
                this.isLoggedIn = true;
                this.getApiUrl(); // Ensure URL is loaded
                return true;
            } catch (e) {
                console.error("Session parse error", e);
                return false;
            }
        }
        return false;
    },

    /**
     * Load Data from Cloud
     */
    async loadData() {
        if (!this.isLoggedIn || !this.currentUser) return { success: false, message: "Chưa đăng nhập" };

        const { username, password } = this.currentUser;
        const result = await this._request({
            action: 'load',
            username: username,
            password: password
        });

        if (result.success && result.data) {
            // If data is string (JSONified), parse it
            return { success: true, data: typeof result.data === 'string' ? JSON.parse(result.data) : result.data };
        }
        return result;
    },

    /**
     * Save Data to Cloud
     */
    async saveData(dataObj) {
        if (!this.isLoggedIn || !this.currentUser) return { success: false, message: "Chưa đăng nhập" };

        const { username, password } = this.currentUser;
        const dataStr = JSON.stringify(dataObj);

        return this._request({
            action: 'save',
            username: username,
            password: password,
            data: dataStr
        });
    }
};
