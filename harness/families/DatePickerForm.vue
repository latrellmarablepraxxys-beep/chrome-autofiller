<script setup lang="ts">
import { ref } from 'vue';
import { VueDatePicker } from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';

const birthdate = ref<Date | null>(null);
const schedule = ref<Date | null>(null);
</script>

<template>
    <section>
        <h2>vue date picker</h2>

        <form id="vue-datepicker" @submit.prevent>
            <div class="field">
                <label>Birthdate *</label>
                <VueDatePicker
                    v-model="birthdate"
                    :format="'MM/dd/yyyy'"
                    :enable-time-picker="false"
                    placeholder="Select birthdate"
                />
            </div>

            <div class="field">
                <label>Scheduled At</label>
                <VueDatePicker
                    v-model="schedule"
                    :format="'MM/dd/yyyy HH:mm'"
                    placeholder="Select schedule"
                />
            </div>
        </form>
    </section>
</template>
