const handlePanelShown = () => {
  console.log('Page Modeller panel shown');
};

const handlePanelHidden = () => {
  console.log('Page Modeller panel hidden');
};

chrome.devtools.panels.create('Page Modeller', 'icons/icon_32.png', 'panel/panel.html', newPanel => {
  newPanel.onShown.addListener(handlePanelShown);
  newPanel.onHidden.addListener(handlePanelHidden);
});
