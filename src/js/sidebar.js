const $ = require('jquery');
const util = require('./util');
window.jQuery = $;
/*
require('../../node_modules/semantic-ui-sass/js/api');
require('../../node_modules/semantic-ui-sass/js/colorize');
require('../../node_modules/semantic-ui-sass/js/form');
require('../../node_modules/semantic-ui-sass/js/state');
require('../../node_modules/semantic-ui-sass/js/visibility');
require('../../node_modules/semantic-ui-sass/js/visit');
require('../../node_modules/semantic-ui-sass/js/site');
require('../../node_modules/semantic-ui-sass/js/accordion');
require('../../node_modules/semantic-ui-sass/js/checkbox');
require('../../node_modules/semantic-ui-sass/js/dimmer');
require('../../node_modules/semantic-ui-sass/js/dropdown');
require('../../node_modules/semantic-ui-sass/js/embed');
require('../../node_modules/semantic-ui-sass/js/modal');
require('../../node_modules/semantic-ui-sass/js/nag');
*/
require('../../node_modules/semantic-ui-sass/js/popup');
/*
require('../../node_modules/semantic-ui-sass/js/progress');
require('../../node_modules/semantic-ui-sass/js/rating');
require('../../node_modules/semantic-ui-sass/js/search');
require('../../node_modules/semantic-ui-sass/js/shape');
require('../../node_modules/semantic-ui-sass/js/sidebar');
require('../../node_modules/semantic-ui-sass/js/sticky');
*/

require('../../node_modules/semantic-ui-sass/js/tab');
require('../../node_modules/semantic-ui-sass/js/transition');

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