const handlePanelShown = function() {
  console.log('Page Modeller panel shown');
};

const handlePanelHidden = function() {
  console.log('Page Modeller panel hidden');
};

chrome.devtools.panels.create('Page Modeller', 'icons/star.png', 'panel/panel.html', function(newPanel) {
  newPanel.onShown.addListener(handlePanelShown);
  newPanel.onHidden.addListener(handlePanelHidden);
});

chrome.runtime.onMessage.addListener(function(msg, sender) {
  switch (msg.type) {
    case 'notify-start-modelling':
      chrome.devtools.inspectedWindow.eval('inspect(document.body)');
      isModelling = true;
      break;
    case 'notify-stop-modelling':
      isModelling = false;
      break;
  }
});
