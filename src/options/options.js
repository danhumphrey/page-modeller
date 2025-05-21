import Vue from 'vue';
import vuetify from '../plugins/vuetify';
import OptionsApp from './OptionsApp';

import 'vuetify/dist/vuetify.min.css';

Vue.config.productionTip = false;

new Vue({
  vuetify,
  render: (h) => h(OptionsApp),
}).$mount('#app');
