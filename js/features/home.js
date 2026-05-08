// js/home.js

const username = "MaulDev13";
const placeholderAvatar = "assets/cs_avatar.jpg";

async function loadGitHubUser() {
    const avatarEl = document.getElementById("avatar");
    const followersEl = document.getElementById("followers-count");
    const followingEl = document.getElementById("following-count");
    const githubLinkEl = document.getElementById("github-link");

    // Jika elemen belum ada, hentikan
    if (!avatarEl) return;

    try {
        const res = await fetch(`https://api.github.com/users/${username}`);

        if (!res.ok) {
            console.warn("GitHub API error:", res.status);
            throw new Error("GitHub API gagal");
        }

        const data = await res.json();

        avatarEl.src = data.avatar_url || placeholderAvatar;
        followersEl.textContent = data.followers ?? "-";
        followingEl.textContent = data.following ?? "-";
        githubLinkEl.href = data.html_url || `https://github.com/${username}`;

    } catch (err) {
        console.error("GitHub fetch error:", err);

        avatarEl.src = placeholderAvatar;
        followersEl.textContent = "-";
        followingEl.textContent = "-";
        githubLinkEl.href = `https://github.com/${username}`;
    }
}

/* =========================================================
   HOME PAGE INIT
========================================================= */
document.body.addEventListener("htmx:afterSwap", (e) => {
    if (
        e.detail.target.id === "content" &&
        document.getElementById("user-card")
    ) {
        loadGitHubUser();
    }
});

/* Initial page load */
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("user-card")) {
        loadGitHubUser();
    }
});