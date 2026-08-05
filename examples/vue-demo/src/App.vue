<template>
  <div class="container">
    <h1>Vue Demo - Natal Chart Calculator</h1>
    
    <form @submit.prevent="calculateChart">
      <div class="form-group">
        <label>Date of Birth:</label>
        <input type="date" v-model="birthDate" required />
        <input type="time" v-model="birthTime" required />
      </div>
      
      <div class="form-group">
        <label>Location:</label>
        <input type="number" v-model.number="latitude" placeholder="Latitude" step="0.0001" required />
        <input type="number" v-model.number="longitude" placeholder="Longitude" step="0.0001" required />
      </div>
      
      <button type="submit" :disabled="loading">
        {{ loading ? 'Calculating...' : 'Calculate Chart' }}
      </button>
    </form>
    
    <div v-if="result" class="result">
      <h2>Sun Position</h2>
      <p>{{ result.sunPosition }}</p>
      
      <h2>Ascendant</h2>
      <p>{{ result.ascendant }}</p>
      
      <h2>Midheaven</h2>
      <p>{{ result.midheaven }}</p>
    </div>
    
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { createSwissEph, Body, HouseSystem, SIGNS } from '@kuntay/swisseph';

const birthDate = ref('1990-05-15');
const birthTime = ref('14:30');
const latitude = ref(41.0082);
const longitude = ref(28.9784);
const loading = ref(false);
const result = ref<{ sunPosition: string; ascendant: string; midheaven: string } | null>(null);
const error = ref<string | null>(null);

async function calculateChart() {
  loading.value = true;
  error.value = null;
  result.value = null;
  
  try {
    const swe = await createSwissEph();
    
    const [year, month, day] = birthDate.value.split('-').map(Number);
    const [hours, minutes] = birthTime.value.split(':').map(Number);
    const hourDecimal = hours + minutes / 60;
    
    const jd = swe.julianDay(year, month, day, hourDecimal);
    
    const sun = swe.calcWithSign(jd, Body.Sun);
    const houses = swe.houses(jd, latitude.value, longitude.value, HouseSystem.Placidus);
    
    result.value = {
      sunPosition: `${sun.degreeInSign.toFixed(2)}° ${sun.sign} (${sun.longitude.toFixed(2)}°)`,
      ascendant: `${houses.ascendant.toFixed(2)}°`,
      midheaven: `${houses.midheaven.toFixed(2)}°`,
    };
    
    swe.dispose();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error occurred';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, sans-serif;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

button {
  background: #4CAF50;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background: #ccc;
}

.result {
  margin-top: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
}

.error {
  margin-top: 1rem;
  padding: 1rem;
  background: #ffebee;
  color: #c62828;
  border-radius: 4px;
}
</style>
