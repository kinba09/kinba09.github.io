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

  var reduceMotion = false;

  try {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (error) {}

  if (!reduceMotion) {
    var revealTargets = document.querySelectorAll(
      ".section, .page-intro, .article-header, .article > h2, .article > p, .article > ul, .article-nav"
    );

    revealTargets.forEach(function (target) {
      target.classList.add("reveal-on-scroll");
    });

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
      );

      revealTargets.forEach(function (target) {
        observer.observe(target);
      });
    } else {
      revealTargets.forEach(function (target) {
        target.classList.add("is-visible");
      });
    }
  }

  if (document.querySelector(".article")) {
    var progress = document.createElement("div");
    progress.className = "scroll-progress";
    document.body.appendChild(progress);

    function updateProgress() {
      var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      var value = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      progress.style.transform = "scaleX(" + Math.min(Math.max(value, 0), 1) + ")";
    }

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
  }

  function initMovingRowHover(list) {
    var rows = list.querySelectorAll(".list-row, .post-row");

    if (!rows.length) {
      return;
    }

    var indicator = document.createElement("span");
    indicator.className = "row-hover-indicator";
    indicator.setAttribute("aria-hidden", "true");
    list.prepend(indicator);

    function moveTo(row) {
      var listRect = list.getBoundingClientRect();
      var rowRect = row.getBoundingClientRect();
      indicator.style.height = rowRect.height + "px";
      indicator.style.setProperty("--hover-y", rowRect.top - listRect.top + "px");
      indicator.style.opacity = "1";
    }

    rows.forEach(function (row) {
      row.addEventListener("pointerenter", function () {
        moveTo(row);
      });

      row.addEventListener("focus", function () {
        moveTo(row);
      });
    });

    list.addEventListener("pointerleave", function () {
      indicator.style.opacity = "0";
    });

    list.addEventListener("focusout", function () {
      window.setTimeout(function () {
        if (!list.contains(document.activeElement)) {
          indicator.style.opacity = "0";
        }
      }, 0);
    });

    window.addEventListener("resize", function () {
      var activeRow = list.querySelector(".list-row:hover, .post-row:hover, .list-row:focus, .post-row:focus");

      if (activeRow) {
        moveTo(activeRow);
      }
    });
  }

  document.querySelectorAll(".compact-list, .post-list").forEach(initMovingRowHover);

  function initMovingLinkHover(list) {
    var links = list.querySelectorAll("a");

    if (!links.length) {
      return;
    }

    var indicator = document.createElement("span");
    indicator.className = "link-hover-indicator";
    indicator.setAttribute("aria-hidden", "true");
    list.prepend(indicator);

    function moveTo(link) {
      var listRect = list.getBoundingClientRect();
      var linkRect = link.getBoundingClientRect();
      indicator.style.width = linkRect.width + "px";
      indicator.style.height = linkRect.height + "px";
      indicator.style.setProperty("--hover-x", linkRect.left - listRect.left + "px");
      indicator.style.setProperty("--hover-y", linkRect.top - listRect.top + "px");
      indicator.style.opacity = "1";
    }

    links.forEach(function (link) {
      link.addEventListener("pointerenter", function () {
        moveTo(link);
      });

      link.addEventListener("focus", function () {
        moveTo(link);
      });
    });

    list.addEventListener("pointerleave", function () {
      indicator.style.opacity = "0";
    });

    list.addEventListener("focusout", function () {
      window.setTimeout(function () {
        if (!list.contains(document.activeElement)) {
          indicator.style.opacity = "0";
        }
      }, 0);
    });

    window.addEventListener("resize", function () {
      var activeLink = list.querySelector("a:hover, a:focus");

      if (activeLink) {
        moveTo(activeLink);
      }
    });
  }

  function initMovingNavUnderline(nav) {
    var links = nav.querySelectorAll("a");
    var activeLink = nav.querySelector('a[aria-current="page"]') || links[0];

    if (!links.length || !activeLink) {
      return;
    }

    var indicator = document.createElement("span");
    indicator.className = "nav-hover-indicator";
    indicator.setAttribute("aria-hidden", "true");
    nav.prepend(indicator);
    nav.classList.add("has-moving-nav");

    function moveTo(link) {
      var navRect = nav.getBoundingClientRect();
      var linkRect = link.getBoundingClientRect();
      indicator.style.width = linkRect.width + "px";
      indicator.style.setProperty("--hover-x", linkRect.left - navRect.left + "px");
      indicator.style.setProperty("--hover-y", linkRect.bottom - navRect.top - 1 + "px");
      indicator.style.opacity = "1";
    }

    moveTo(activeLink);

    links.forEach(function (link) {
      link.addEventListener("pointerenter", function () {
        moveTo(link);
      });

      link.addEventListener("focus", function () {
        moveTo(link);
      });
    });

    nav.addEventListener("pointerleave", function () {
      moveTo(activeLink);
    });

    nav.addEventListener("focusout", function () {
      window.setTimeout(function () {
        if (!nav.contains(document.activeElement)) {
          moveTo(activeLink);
        }
      }, 0);
    });

    window.addEventListener("resize", function () {
      moveTo(activeLink);
    });
  }

  document.querySelectorAll(".link-strip .inline-links").forEach(initMovingLinkHover);
  document.querySelectorAll(".site-nav").forEach(initMovingNavUnderline);
})();
