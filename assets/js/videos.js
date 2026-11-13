(function () {
  "use strict";

  document.querySelectorAll("[data-player][data-start]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      // Modified clicks retain normal link behavior, including opening YouTube.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var player = document.getElementById(link.dataset.player);
      var seconds = Number(link.dataset.start);
      if (!player || !Number.isInteger(seconds) || seconds < 0) return;
      event.preventDefault();

      var source = new URL(player.src);
      source.searchParams.set("start", String(seconds));
      source.searchParams.set("autoplay", "1");
      player.src = source.href;

      var entry = link.closest(".video-entry");
      entry.querySelectorAll("[data-start]").forEach(function (item) {
        item.removeAttribute("aria-current");
      });
      link.setAttribute("aria-current", "true");
      var time = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
      entry.querySelector(".video-status").textContent = "Selected start time: " + time + ".";
    });
  });
})();
