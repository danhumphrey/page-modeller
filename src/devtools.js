/*
const builder = require('./model-builder');
const util = require('./util');

let isModelling = false;

*/

const handlePanelShown = function() {
  console.log(`Page Modeller panel shown`);
};

const handlePanelHidden = function() {
  console.log('Page Modeller panel hidden');
};

const handleModelBuild = function(model) {
  console.log(model);
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
