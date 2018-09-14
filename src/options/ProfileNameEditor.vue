<template>
  <v-dialog v-model="dialog" :max-width="490">
    <form>
      <v-card>
        <v-card-title class="pa-2">
          <span class="headline">Profile Name</span>
        </v-card-title>
        <v-card-text class="pb-1">
          <v-container grid-list-md pa-0>
            <v-layout wrap>
              <v-flex>
                <v-text-field
                  v-model="profileName"
                  label="Name"
                  :error-messages="profileNameErrors"
                  required
                  @input="$v.profileName.$touch()"
                  @blur="$v.profileName.$touch()"
                ></v-text-field>
              </v-flex>
            </v-layout>
          </v-container>
        </v-card-text>
        <v-card-actions class="py-1">
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" flat @click.native="dialog = false">Cancel</v-btn>
          <v-btn color="blue darken-1" flat @click.native="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </form>
  </v-dialog>
</template>
<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { alphaNum } from 'vuelidate/lib/validators';

const uniqueName = function(n) {
  const res = this.profiles.filter(p => p.name === n);
  return this.editing ? res.length === 1 : res.length === 0;
};

export default {
  mixins: [validationMixin],
  validations: {
    profileName: { required, alphaNum, uniqueName },
  },
  name: 'ProfileNameEditor',
  data() {
    return {
      dialog: false,
      editing: false,
      profileName: '',
      profiles: [],
    };
  },
  computed: {
    profileNameErrors() {
      const errors = [];
      if (!this.$v.profileName.$dirty) {
        return errors;
      }
      !this.$v.profileName.required && errors.push('Name is required.');
      !this.$v.profileName.alphaNum && errors.push('Name must contain alphanumeric characters only.');
      !this.$v.profileName.uniqueName && errors.push('Name must be unique.');
      return errors;
    },
  },
  methods: {
    create(profiles) {
      this.editing = false;
      this.profileName = '';
      this.profiles = profiles;
      this.dialog = true;
    },
    edit(profiles, profileName) {
      this.editing = true;
      this.profiles = profiles;
      this.profileName = profileName;
      this.dialog = true;
    },
    close(saved = false) {
      this.dialog = false;
      this.$v.$reset();
    },
    save() {
      this.$v.$touch();
      if (!this.$v.$invalid) {
        this.$emit('created', this.profileName);
        this.close(true);
      }
    },
  },
  watch: {
    dialog(val) {
      val || this.close();
    },
  },
};
</script>

<style scoped>
</style>
