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

    // OPEN CURRENT
    if (!isOpen) {
        target.classList.remove("hidden");
        button.querySelector(".arrow").textContent = "▲";

        // ✅ smooth scroll to opened content
        setTimeout(() => {
            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }, 50);
    }
}
