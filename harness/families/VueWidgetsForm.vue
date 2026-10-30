<script setup lang="ts">
import { ref } from 'vue';
import vSelect from 'vue-select';
import Multiselect from 'vue-multiselect';
import 'vue-select/dist/vue-select.css';
import 'vue-multiselect/dist/vue-multiselect.min.css';

const city = ref<number | null>(null);
const skills = ref<string[]>([]);

const cities = [
    { value: 1, label: 'City One' },
    { value: 2, label: 'City Two' },
    { value: 3, label: 'City Three' },
];

const skillOptions = ['Vue', 'TypeScript', 'Laravel', 'Playwright'];
</script>

<template>
    <section>
        <h2>vue-select + vue-multiselect</h2>

        <form id="vue-widgets" @submit.prevent>
            <div class="field">
                <label>City *</label>
                <v-select
                    v-model="city"
                    :options="cities"
                    :reduce="(option: { value: number }) => option.value"
                    label="label"
                    data-testid="widgets-city"
                />
            </div>

            <div class="field">
                <label>Skills</label>
                <Multiselect
                    v-model="skills"
                    :options="skillOptions"
                    :multiple="true"
                    placeholder="Select skills"
                />
            </div>
        </form>
    </section>
</template>
