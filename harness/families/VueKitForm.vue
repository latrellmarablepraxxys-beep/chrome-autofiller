<script setup lang="ts">
import { ref } from 'vue';
import { PrxSelect } from '@prx-kit/components/widget/forms/select';
import { PrxSearchableSelect } from '@prx-kit/components/widget/forms/searchable-select';
import { PrxMultiSelect } from '@prx-kit/components/widget/forms/multiselect';
import { PrxDatePicker } from '@prx-kit/components/widget/forms/date-picker';
import { PrxFileUpload } from '@prx-kit/components/widget/forms/file-upload';
import { PrxTextInput } from '@prx-kit/components/widget/forms/text-input';

const region = ref<string | number>('');
const city = ref<unknown>(null);
const businessTypes = ref<unknown[]>([]);
const birthdate = ref<unknown>(null);
const notes = ref('');
const photo = ref<unknown>(null);

const regions = [
    { value: 'alpha', label: 'Alpha' },
    { value: 'beta', label: 'Beta' },
    { value: 'gamma', label: 'Gamma' },
];

const types = [
    { value: 'corporation', label: 'Corporation' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'sole', label: 'Sole Proprietorship' },
];

const state = () => ({
    region: region.value,
    city: city.value,
    businessTypes: businessTypes.value,
    birthdate: birthdate.value,
    notes: notes.value,
});
</script>

<template>
    <section>
        <h2>praxxys vue kit</h2>

        <form id="vue-kit" @submit.prevent>
            <PrxTextInput
                v-model="notes"
                test-id="kit-notes"
                label="Notes"
                placeholder="Notes"
            />

            <PrxSelect
                v-model="region"
                test-id="kit-region"
                label="Region"
                placeholder="Select region"
                :options="regions"
                is-searchable
                required
            />

            <PrxSearchableSelect
                v-model="city"
                test-id="kit-city"
                label="City"
                placeholder="Select city"
                search-route="harness.cities"
                required
            />

            <PrxMultiSelect
                v-model="businessTypes"
                test-id="kit-tags"
                label="Business Types"
                :options="types"
                placeholder="Select business types"
                multiple
                required
            />

            <PrxDatePicker
                v-model="birthdate"
                label="Birthdate"
                placeholder="Select birthdate"
                format="MM/dd/yyyy"
                required
            />

            <PrxFileUpload
                v-model="photo"
                test-id="kit-photo"
                label="Photo"
                :accept-types="['image']"
            />
        </form>

        <pre class="kit-state">{{ JSON.stringify(state(), null, 2) }}</pre>
    </section>
</template>
