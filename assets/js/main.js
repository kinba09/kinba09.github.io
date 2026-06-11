(function () {
  var root = document.documentElement;
  var toggle = document.querySelector("[data-theme-toggle]");
  var label = document.querySelector("[data-theme-label]");

  function getStoredTheme() {
    try {
      return localStorage.getItem("theme");
    } catch (error) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem("theme", theme);
    } catch (error) {}
  }

  function applyTheme(theme) {
    if (theme === "light") {
      root.dataset.theme = "light";
    } else {
      root.dataset.theme = "dark";
    }

    if (toggle) {
      toggle.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    }

    if (label) {
      label.textContent = theme === "light" ? "Dark" : "Light";
    }
  }

  var initialTheme = getStoredTheme() === "light" ? "light" : "dark";
  applyTheme(initialTheme);

  if (toggle) {
    toggle.addEventListener("click", function () {
      var nextTheme = root.dataset.theme === "light" ? "dark" : "light";
      applyTheme(nextTheme);
      storeTheme(nextTheme);
    });
  }
})();
