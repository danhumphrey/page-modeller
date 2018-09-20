const handlePanelShown = function() {
  console.log('Page Modeller panel shown');
};

const handlePanelHidden = function() {
  console.log('Page Modeller panel hidden');
};

chrome.devtools.panels.create('Page Modeller', 'icons/icon_32.png', 'panel/panel.html', newPanel => {
  newPanel.onShown.addListener(handlePanelShown);
  newPanel.onHidden.addListener(handlePanelHidden);
});
