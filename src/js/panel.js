const $ = require('jquery');
const util = require('./util');
window.jQuery = $;


let hasModel = false;

$('.btn').popup({
    delay: {
        show: 700,
        hide: 0
    }
});

$('.tabular.menu .item')
  .tab()
;

$('.btn.toggle').on('click', function() {
    let el = $(this),
        id = el.attr('id');
    if(el.hasClass('active')) {
        el.removeClass('active').siblings().prop("disabled", false);
        util.sendMessage('notify-stop-modelling', {id: id});
    }else {
        el.addClass('active').siblings().removeClass('active').prop("disabled", true);
        util.sendMessage('notify-start-modelling', {id: id});
    }
});

chrome.runtime.onMessage.addListener(function(msg, sender){
    switch(msg.type) {
        case 'notify-modelling-complete':
            $('.btn.toggle.active').removeClass('active').siblings().prop("disabled", false);
            break;
        case '':
            break;
    }
});