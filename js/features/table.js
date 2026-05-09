

/* =========================================================
   SKILL TABLE INTERACTION
   - Sort table
   - Filter by tabs
   - Row selection
   - Keyboard navigation
   - HTMX safe
   ========================================================= */

(() => {

	/* =====================================================
	   ELEMENTS
	   ===================================================== */

	const table = document.querySelector("table");

	if (!table) return;

	const tbody = table.querySelector("tbody");

	let rows = [...tbody.querySelectorAll("tr")];

	const tabs = [...document.querySelectorAll(".tag")];

	const headers = [...table.querySelectorAll("th.sortable")];

	/* =====================================================
	   STATE
	   ===================================================== */

	let selectedRowIndex = -1;

	let currentSort = {
		index: 0,
		direction: "asc"
	};

	let currentFilter = "all";

	/* =====================================================
	   HELPERS
	   ===================================================== */

	function refreshRows() {

		rows = [...tbody.querySelectorAll("tr")];
	}

	function getCellValue(row, index) {

		return row.children[index]
			?.innerText
			.trim()
			.toLowerCase() || "";
	}

	function getVisibleRows() {

		return rows.filter(row =>
			row.style.display !== "none"
		);
	}

	/* =====================================================
	   SORT TABLE
	   ===================================================== */

	function sortTable(index, direction = "asc") {

		refreshRows();

		const sorted = [...rows].sort((a, b) => {

			const A = getCellValue(a, index);
			const B = getCellValue(b, index);

			const isNumeric =
				!isNaN(A) &&
				!isNaN(B);

			if (isNumeric) {

				return direction === "asc"
					? Number(A) - Number(B)
					: Number(B) - Number(A);
			}

			return direction === "asc"
				? A.localeCompare(B)
				: B.localeCompare(A);
		});

		tbody.innerHTML = "";

		sorted.forEach(row => {
			tbody.appendChild(row);
		});

		refreshRows();
	}

	/* =====================================================
	   SORT HEADER EVENTS
	   ===================================================== */

	headers.forEach((header, index) => {

		header.addEventListener("click", () => {

			headers.forEach(th => {
				th.classList.remove("asc", "desc");
			});

			const direction =
				currentSort.index === index &&
				currentSort.direction === "asc"
					? "desc"
					: "asc";

			currentSort = {
				index,
				direction
			};

			header.classList.add(direction);

			sortTable(index, direction);
		});
	});

	/* =====================================================
	   FILTER TABS
	   ===================================================== */

	function applyFilter(filter) {

		currentFilter = filter;

		rows.forEach(row => {

			const category =
				row.dataset.category || "";

			const level =
				row.dataset.level || "";

			let visible = false;

			if (filter === "all") {

				visible = true;
			}

			else if (
				category === filter ||
				level === filter
			) {

				visible = true;
			}

			row.style.display =
				visible
					? ""
					: "none";
		});

		selectedRowIndex = -1;
	}

	tabs.forEach(tab => {

		tab.addEventListener("click", () => {

			tabs.forEach(btn => {
				btn.classList.remove("active");
			});

			tab.classList.add("active");

			const filter =
				tab.dataset.filter;

			applyFilter(filter);
		});
	});

	/* =====================================================
	   ROW SELECT
	   ===================================================== */

	function clearSelection() {

		rows.forEach(row => {
			row.classList.remove("selected");
		});
	}

	function selectRow(index) {

		const visibleRows =
			getVisibleRows();

		const row =
			visibleRows[index];

		if (!row) return;

		clearSelection();

		row.classList.add("selected");

		selectedRowIndex = index;

		row.scrollIntoView({
			block: "nearest",
			behavior: "smooth"
		});
	}

	function bindRowEvents() {

		refreshRows();

		rows.forEach(row => {

			row.setAttribute(
				"tabindex",
				"0"
			);

			row.addEventListener("click", () => {

				const visibleRows =
					getVisibleRows();

				const index =
					visibleRows.indexOf(row);

				selectRow(index);
			});

			row.addEventListener("dblclick", () => {

				console.log(
					"Open detail:",
					row.children[0]?.innerText
				);
			});
		});
	}

	bindRowEvents();

	/* =====================================================
	   KEYBOARD NAVIGATION
	   ===================================================== */

	document.addEventListener("keydown", (e) => {

		const active =
			document.activeElement.tagName;

		if (
			active === "INPUT" ||
			active === "TEXTAREA" ||
			active === "SELECT"
		) {
			return;
		}

		const visibleRows =
			getVisibleRows();

		switch (e.key) {

			case "ArrowDown":

				e.preventDefault();

				selectedRowIndex =
					Math.min(
						selectedRowIndex + 1,
						visibleRows.length - 1
					);

				selectRow(selectedRowIndex);

				break;

			case "ArrowUp":

				e.preventDefault();

				selectedRowIndex =
					Math.max(
						selectedRowIndex - 1,
						0
					);

				selectRow(selectedRowIndex);

				break;

			case "Escape":

				clearSelection();

				selectedRowIndex = -1;

				break;

			case "Enter":

				if (
					selectedRowIndex >= 0 &&
					visibleRows[selectedRowIndex]
				) {

					visibleRows[selectedRowIndex]
						.dispatchEvent(
							new Event("dblclick")
						);
				}

				break;
		}
	});

	/* =====================================================
	   DEFAULT SORT
	   ===================================================== */

	sortTable(
		currentSort.index,
		currentSort.direction
	);

	headers[0].classList.add("asc");

	/* =====================================================
	   HTMX SUPPORT
	   ===================================================== */

	document.body.addEventListener(
		"htmx:afterSwap",
		() => {

			refreshRows();

			bindRowEvents();

			applyFilter(currentFilter);

			sortTable(
				currentSort.index,
				currentSort.direction
			);
		}
	);

})();
