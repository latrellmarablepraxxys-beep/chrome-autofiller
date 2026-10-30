<script setup lang="ts">
import NativeForm from './families/NativeForm.vue';
import ShadcnForm from './families/ShadcnForm.vue';
import VueKitForm from './families/VueKitForm.vue';
import VueWidgetsForm from './families/VueWidgetsForm.vue';
import DatePickerForm from './families/DatePickerForm.vue';

const families = [
    { id: 'native', label: 'Native HTML' },
    { id: 'shadcn', label: 'shadcn + reka' },
    { id: 'vue-kit', label: 'PRAXXYS Vue Kit' },
    { id: 'vue-widgets', label: 'vue-select / vue-multiselect' },
    { id: 'vue-datepicker', label: 'Vue Date Picker' },
];
</script>

<template>
    <main>
        <h1>PRAXXYS Autofill harness</h1>
        <p class="intro">
            Every section mounts real component packages, not static mocks. Run a fill and
            check the HUD report against the per-family checklist in
            <code>docs/QA-CHECKLIST.md</code>.
        </p>

        <nav>
            <a v-for="family in families" :key="family.id" :href="`#${family.id}`">
                {{ family.label }}
            </a>
        </nav>

        <NativeForm id="native" />
        <ShadcnForm id="shadcn" />
        <VueKitForm id="vue-kit" />
        <VueWidgetsForm id="vue-widgets" />
        <DatePickerForm id="vue-datepicker" />
    </main>
</template>
