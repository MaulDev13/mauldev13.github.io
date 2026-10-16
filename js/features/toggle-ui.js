function toggleProject(button, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    const isOpen = !target.classList.contains("hidden");

    // CLOSE ALL PROJECTS
    document.querySelectorAll(".project-content")
        .forEach(el => el.classList.add("hidden"));

    // RESET ALL ARROWS
    document.querySelectorAll(".arrow")
        .forEach(el => el.textContent = "▼");

    // RESET ALL OPEN STATES
    document.querySelectorAll(".project-item.is-open")
        .forEach(el => el.classList.remove("is-open"));

    // OPEN CURRENT
    if (!isOpen) {
        target.classList.remove("hidden");
        button.querySelector(".arrow").textContent = "▲";

        // Mark the surrounding card as open (for CV-style header styling)
        const item = button.closest(".project-item");
        if (item) item.classList.add("is-open");

        // ✅ smooth scroll to opened content
        setTimeout(() => {
            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }, 50);
    }
}
