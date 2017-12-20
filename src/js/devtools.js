'use strict';

function handlePanelShown() {
    console.log("Page Modeller panel shown");
}

function handlePanelHidden() {
    console.log("Page Modeller panel hidden");
}

chrome.devtools.panels.elements.createSidebarPane(
    "Page Modeller",
    function(sidebarPanel) {
        sidebarPanel.setPage('sidebar-page.html');
        sidebarPanel.onShown.addListener(handlePanelShown);
        sidebarPanel.onHidden.addListener(handlePanelHidden);
    }
);
