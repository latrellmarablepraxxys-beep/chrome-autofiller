<script setup lang="ts">
import { ref } from 'vue';

const fullName = ref('');
const bio = ref('');
const status = ref('');
const tags = ref<string[]>([]);
const published = ref('');
const birthday = ref('');
const startMonth = ref('');
const startTime = ref('');
const volume = ref('50');
const brandColor = ref('#7c3aed');
const photo = ref<File | null>(null);
const newsletter = ref(false);

const onPhoto = (event: Event) => {
    photo.value = (event.target as HTMLInputElement).files?.[0] ?? null;
};
</script>

<template>
    <section>
        <h2>native html</h2>

        <form id="native" @submit.prevent>
            <div class="field">
                <label for="native-name">Full Name *</label>
                <input id="native-name" v-model="fullName" name="full_name" required />
            </div>

            <div class="field">
                <label for="native-bio">Bio</label>
                <textarea id="native-bio" v-model="bio" name="bio"></textarea>
            </div>

            <div class="field">
                <label for="native-status">Status *</label>
                <select id="native-status" v-model="status" name="status" required>
                    <option value="">Select status</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                </select>
            </div>

            <div class="field">
                <label for="native-tags">Tags</label>
                <select id="native-tags" v-model="tags" name="tags" multiple>
                    <option value="coffee">Coffee</option>
                    <option value="dessert">Dessert</option>
                    <option value="seasonal">Seasonal</option>
                </select>
            </div>

            <div class="field">
                <label>Published</label>
                <label><input v-model="published" type="radio" name="published" value="yes" /> Yes</label>
                <label><input v-model="published" type="radio" name="published" value="no" /> No</label>
            </div>

            <div class="field">
                <label for="native-birthday">Birthday</label>
                <input id="native-birthday" v-model="birthday" type="date" name="birthday" />
            </div>

            <div class="field">
                <label for="native-month">Start Month</label>
                <input id="native-month" v-model="startMonth" type="month" name="start_month" />
            </div>

            <div class="field">
                <label for="native-time">Start Time</label>
                <input id="native-time" v-model="startTime" type="time" name="start_time" />
            </div>

            <div class="field">
                <label for="native-volume">Volume</label>
                <input id="native-volume" v-model="volume" type="range" name="volume" min="1" max="100" />
            </div>

            <div class="field">
                <label for="native-color">Brand Color</label>
                <input id="native-color" v-model="brandColor" type="color" name="brand_color" />
            </div>

            <div class="field">
                <label for="native-photo">Photo</label>
                <input id="native-photo" type="file" accept="image/png,image/jpeg" @change="onPhoto" />
            </div>

            <div class="field">
                <label>
                    <input v-model="newsletter" type="checkbox" name="newsletter" />
                    Subscribe to updates
                </label>
            </div>
        </form>

        <pre class="native-state">{{ JSON.stringify({ fullName, status, tags, published, birthday, startMonth }, null, 2) }}</pre>
    </section>
</template>
