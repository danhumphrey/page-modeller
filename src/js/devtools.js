const builder = require('./model-builder');
const util = require('./util');
const elementsPanel = chrome.devtools.panels.elements;

let modelling = false;

const handlePanelShown = function() {
    console.log("Page Modeller panel shown");
}

const handlePanelHidden = function() {
    console.log("Page Modeller panel hidden");
}

const handleModelBuild = function(model) {
    console.log(model);
}

elementsPanel.createSidebarPane(
    "Page Modeller",
    function(sidebarPanel) {
        sidebarPanel.setPage('sidebar-page.html');
        sidebarPanel.onShown.addListener(handlePanelShown);
        sidebarPanel.onHidden.addListener(handlePanelHidden);
    }
);

elementsPanel.onSelectionChanged.addListener(function() {
    if(modelling) {
        chrome.devtools.inspectedWindow.eval('(' + builder.toString() + ')($0).build()',{
            useContentScriptContext: true
        }, handleModelBuild);
        modelling = false;
        util.sendMessage('notify-modelling-complete');
    }
});

chrome.runtime.onMessage.addListener(function(msg, sender){
    switch(msg.type) {
        case 'notify-start-modelling':
            chrome.devtools.inspectedWindow.eval('inspect(document.body)');
            modelling = true;
            break;
        case 'notify-stop-modelling':
            modelling = false;
            break;
    }
});