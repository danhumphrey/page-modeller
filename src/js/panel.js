const util = require("./util");

let hasModel = false;

$(".btn").popup({
  delay: {
    show: 700,
    hide: 0
  }
});

chrome.runtime.onMessage.addListener(function(msg, sender) {
  switch (msg.type) {
    case "notify-modelling-complete":
      $(".btn.toggle.active")
        .removeClass("active")
        .siblings()
        .prop("disabled", false);
      break;
    case "":
      break;
  }
});
