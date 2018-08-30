const handlePanelShown = function() {
  console.log('Page Modeller panel shown');
};

const handlePanelHidden = function() {
  console.log('Page Modeller panel hidden');
};

chrome.devtools.panels.create('Page Modeller', 'icons/icon_32.png', 'panel/panel.html', function(newPanel) {
  newPanel.onShown.addListener(handlePanelShown);
  newPanel.onHidden.addListener(handlePanelHidden);
});

chrome.runtime.onMessage.addListener(function(msg) {
  switch (msg.type) {
    case 'notify-start-modelling':
      chrome.devtools.inspectedWindow.eval('inspect(document.body)');
      break;
    case 'notify-stop-modelling':
      break;
  }
});
