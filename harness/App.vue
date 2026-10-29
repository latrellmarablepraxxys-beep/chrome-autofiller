<script setup lang="ts">
import { computed, ref } from 'vue';
import vSelect from 'vue-select';
import 'vue-select/dist/vue-select.css';
import {
    CheckboxIndicator,
    CheckboxRoot,
    ComboboxAnchor,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxPortal,
    ComboboxRoot,
    ComboboxTrigger,
    ComboboxViewport,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
    DialogTrigger,
    RadioGroupItem,
    RadioGroupRoot,
    SelectContent,
    SelectItem,
    SelectPortal,
    SelectRoot,
    SelectTrigger,
    SelectValue,
    SelectViewport,
    SwitchRoot,
    SwitchThumb,
    ToggleGroupItem,
    ToggleGroupRoot,
} from 'reka-ui';

const fullName = ref('');
const notes = ref('');
const selectValue = ref('');
const cityValue = ref<number | null>(null);
const comboValue = ref('');
const comboOpen = ref(false);
const comboOnlyValue = ref('');
const comboOnlyOpen = ref(false);
const gender = ref('');
const active = ref(false);
const agree = ref(false);
const subscribe = ref(false);
const noMiddle = ref(false);
const published = ref(false);
const view = ref('');
const dialogOpen = ref(false);
const dialogFull = ref('');
const dialogRegion = ref('');
const dialogLabel = ref('');

const regions = ['Alpha', 'Beta', 'Gamma'];
const businessTypes = ['Corporation', 'Partnership', 'Sole Proprietorship'];
const cityOptions = [
    { value: 1, label: 'City One' },
    { value: 2, label: 'City Two' },
    { value: 3, label: 'City Three' },
];

const state = computed(() => ({
    fullName: fullName.value,
    notes: notes.value,
    selectValue: selectValue.value,
    cityValue: cityValue.value,
    comboValue: comboValue.value,
    comboOnlyValue: comboOnlyValue.value,
    gender: gender.value,
    active: active.value,
    agree: agree.value,
    subscribe: subscribe.value,
    noMiddle: noMiddle.value,
    published: published.value,
    view: view.value,
    dialogOpen: dialogOpen.value,
    dialogFull: dialogFull.value,
    dialogRegion: dialogRegion.value,
    dialogLabel: dialogLabel.value,
}));
</script>

<template>
    <main>
        <h1>Reka / shadcn harness</h1>

        <form id="harness" @submit.prevent>
            <div class="field">
                <label for="full-name">Full Name *</label>
                <input id="full-name" v-model="fullName" data-testid="full-name" />
            </div>

            <div class="field">
                <label for="notes">Notes</label>
                <textarea id="notes" v-model="notes" data-testid="notes"></textarea>
            </div>

            <div class="field">
                <label>Region *</label>
                <SelectRoot v-model="selectValue">
                    <SelectTrigger data-slot="select-trigger" class="trigger" data-testid="select-trigger">
                        <SelectValue placeholder="Select region" />
                        <span>▾</span>
                    </SelectTrigger>
                    <SelectPortal>
                        <SelectContent class="content" data-slot="select-content">
                            <div class="search">
                                <input placeholder="Search..." />
                            </div>
                            <SelectViewport>
                                <SelectItem
                                    v-for="option in regions"
                                    :key="option"
                                    :value="option"
                                    data-slot="select-item"
                                    class="item"
                                >
                                    {{ option }}
                                </SelectItem>
                            </SelectViewport>
                        </SelectContent>
                    </SelectPortal>
                </SelectRoot>
            </div>

            <div class="field">
                <label>City *</label>
                <v-select
                    v-model="cityValue"
                    :options="cityOptions"
                    :reduce="(option: { value: number }) => option.value"
                    label="label"
                    data-testid="city-select"
                />
            </div>

            <div class="field">
                <label>Business Type *</label>
                <ComboboxRoot v-model="comboValue" v-model:open="comboOpen">
                    <ComboboxAnchor data-slot="combobox" class="anchor">
                        <div data-slot="combobox-anchor" class="anchor-inner">
                            <ComboboxInput
                                data-slot="command-input"
                                class="combo-input"
                                placeholder="Select business type here"
                                data-testid="combo-input"
                            />
                            <ComboboxTrigger
                                data-slot="combobox-trigger"
                                class="combo-trigger"
                                aria-label="Show popup"
                                data-testid="combo-trigger"
                            >
                                ▾
                            </ComboboxTrigger>
                        </div>
                    </ComboboxAnchor>
                    <ComboboxPortal>
                        <ComboboxContent class="content" data-slot="combobox-content">
                            <ComboboxViewport>
                                <ComboboxItem
                                    v-for="option in businessTypes"
                                    :key="option"
                                    :value="option"
                                    data-slot="combobox-item"
                                    class="item"
                                >
                                    {{ option }}
                                </ComboboxItem>
                            </ComboboxViewport>
                        </ComboboxContent>
                    </ComboboxPortal>
                </ComboboxRoot>
            </div>

            <div class="field">
                <label>Sole Proprietor Type</label>
                <ComboboxRoot v-model="comboOnlyValue" v-model:open="comboOnlyOpen">
                    <ComboboxAnchor data-slot="combobox" class="anchor">
                        <ComboboxInput
                            data-slot="command-input"
                            class="combo-input"
                            placeholder="Select proprietor type"
                            data-testid="combo-only-input"
                        />
                    </ComboboxAnchor>
                    <ComboboxPortal>
                        <ComboboxContent class="content" data-slot="combobox-content">
                            <ComboboxViewport>
                                <ComboboxItem
                                    v-for="option in businessTypes"
                                    :key="option"
                                    :value="option"
                                    data-slot="combobox-item"
                                    class="item"
                                >
                                    {{ option }}
                                </ComboboxItem>
                            </ComboboxViewport>
                        </ComboboxContent>
                    </ComboboxPortal>
                </ComboboxRoot>
            </div>

            <div class="field">
                <label>Gender *</label>
                <RadioGroupRoot
                    v-model="gender"
                    data-slot="radio-group"
                    class="row"
                    role="radiogroup"
                >
                    <label class="row">
                        <RadioGroupItem value="male" data-slot="radio-group-item" />
                        Male
                    </label>
                    <label class="row">
                        <RadioGroupItem value="female" data-slot="radio-group-item" />
                        Female
                    </label>
                </RadioGroupRoot>
            </div>

            <div class="field">
                <label class="row">
                    <CheckboxRoot v-model="active" data-slot="checkbox" data-testid="active">
                        <CheckboxIndicator>✓</CheckboxIndicator>
                    </CheckboxRoot>
                    Active
                </label>
            </div>

            <div class="field">
                <label class="row">
                    <CheckboxRoot v-model="agree" data-slot="checkbox" data-testid="agree">
                        <CheckboxIndicator>✓</CheckboxIndicator>
                    </CheckboxRoot>
                    I agree to the terms *
                </label>
            </div>

            <div class="field">
                <label class="row">
                    <CheckboxRoot v-model="subscribe" data-slot="checkbox" data-testid="subscribe">
                        <CheckboxIndicator>✓</CheckboxIndicator>
                    </CheckboxRoot>
                    Subscribe to updates
                </label>
            </div>

            <div class="field">
                <label class="row">
                    <CheckboxRoot v-model="noMiddle" data-slot="checkbox" data-testid="no-middle">
                        <CheckboxIndicator>✓</CheckboxIndicator>
                    </CheckboxRoot>
                    I have no middle name
                </label>
            </div>

            <div class="field">
                <label>Published</label>
                <SwitchRoot v-model="published" data-slot="switch" data-testid="published">
                    <SwitchThumb class="thumb" />
                </SwitchRoot>
            </div>

            <div class="field">
                <label>View *</label>
                <ToggleGroupRoot
                    v-model="view"
                    type="single"
                    data-slot="toggle-group"
                    class="row"
                >
                    <ToggleGroupItem
                        value="list"
                        data-slot="toggle-group-item"
                        class="toggle"
                    >
                        List
                    </ToggleGroupItem>
                    <ToggleGroupItem
                        value="grid"
                        data-slot="toggle-group-item"
                        class="toggle"
                    >
                        Grid
                    </ToggleGroupItem>
                </ToggleGroupRoot>
            </div>

            <button type="button" data-testid="open-dialog" @click="dialogOpen = true">
                Open address dialog
            </button>
        </form>

        <DialogRoot v-model:open="dialogOpen">
            <DialogTrigger as-child>
                <span />
            </DialogTrigger>
            <DialogPortal>
                <DialogOverlay class="overlay" />
                <DialogContent class="dialog" data-testid="address-dialog">
                    <DialogTitle>Add New Address</DialogTitle>
                    <DialogDescription class="sr-only">Address form</DialogDescription>

                    <form @submit.prevent>
                        <div class="field">
                            <label for="dialog-full">Full Name *</label>
                            <input id="dialog-full" v-model="dialogFull" data-testid="dialog-full" />
                        </div>

                        <div class="field">
                            <label>Region *</label>
                            <SelectRoot v-model="dialogRegion">
                                <SelectTrigger
                                    data-slot="select-trigger"
                                    class="trigger"
                                    data-testid="dialog-region"
                                >
                                    <SelectValue placeholder="Select region" />
                                    <span>▾</span>
                                </SelectTrigger>
                                <SelectPortal>
                                    <SelectContent class="content" data-slot="select-content">
                                        <SelectViewport>
                                            <SelectItem
                                                v-for="option in regions"
                                                :key="option"
                                                :value="option"
                                                data-slot="select-item"
                                                class="item"
                                            >
                                                {{ option }}
                                            </SelectItem>
                                        </SelectViewport>
                                    </SelectContent>
                                </SelectPortal>
                            </SelectRoot>
                        </div>

                        <div class="field">
                            <p>Label as *</p>
                            <div class="row">
                                <button type="button" @click="dialogLabel = 'Home'">Home</button>
                                <button type="button" @click="dialogLabel = 'Work'">Work</button>
                                <button type="button" @click="dialogLabel = 'Other'">Other</button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </DialogPortal>
        </DialogRoot>

        <pre id="state">{{ JSON.stringify(state, null, 2) }}</pre>
    </main>
</template>
