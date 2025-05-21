import Vue from 'vue';
import vuetify from '../plugins/vuetify';
import App from './App';

import 'vuetify/dist/vuetify.css';

Vue.config.devtools = false;
new Vue({
  vuetify,
  render: (h) => h(App),
}).$mount('#app');
