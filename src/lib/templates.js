// Plantillas de rutina por meta. Los nombres de ejercicios corresponden
// al seed de la biblioteca en supabase/schema.sql.

const T = (sets, reps, rest) => ({ sets, reps, rest })

export const ROUTINE_TEMPLATES = {
  masa: [
    {
      name: 'Push Pull Legs (6 días)',
      days: [
        { name: 'Push A', emoji: '🔵', color: '#0A84FF', muscles: ['pecho', 'hombro', 'triceps'], exercises: [
          ['Press banca con barra', T(4, '8-12', 90)], ['Press inclinado con mancuernas', T(3, '8-12', 90)],
          ['Press de hombros con mancuernas', T(3, '8-12', 90)], ['Elevaciones laterales', T(3, '12-15', 60)],
          ['Extensión de tríceps en polea', T(3, '10-12', 60)],
        ] },
        { name: 'Pull A', emoji: '🟢', color: '#30D158', muscles: ['espalda', 'biceps'], exercises: [
          ['Dominadas', T(4, '6-10', 90)], ['Remo con barra', T(3, '8-12', 90)],
          ['Remo en polea baja', T(3, '10-12', 90)], ['Face pull', T(3, '12-15', 60)],
          ['Curl con barra', T(3, '8-12', 60)],
        ] },
        { name: 'Legs A', emoji: '🟠', color: '#FF9F0A', muscles: ['pierna'], exercises: [
          ['Sentadilla con barra', T(4, '8-12', 120)], ['Prensa de pierna', T(3, '10-12', 90)],
          ['Peso muerto rumano', T(3, '8-12', 90)], ['Extensión de cuádriceps', T(3, '12-15', 60)],
          ['Elevación de talones de pie', T(4, '12-15', 45)],
        ] },
        { name: 'Push B', emoji: '🔷', color: '#64D2FF', muscles: ['pecho', 'hombro', 'triceps'], exercises: [
          ['Press plano con mancuernas', T(4, '8-12', 90)], ['Cruce de poleas', T(3, '12-15', 60)],
          ['Press militar con barra', T(3, '8-10', 90)], ['Press francés', T(3, '10-12', 60)],
          ['Fondos en paralelas', T(3, '8-12', 90)],
        ] },
        { name: 'Pull B', emoji: '💚', color: '#30D158', muscles: ['espalda', 'biceps'], exercises: [
          ['Jalón al pecho', T(4, '8-12', 90)], ['Remo con mancuerna a una mano', T(3, '8-12', 90)],
          ['Pullover en polea', T(3, '12-15', 60)], ['Curl martillo', T(3, '10-12', 60)],
          ['Curl predicador', T(3, '10-12', 60)],
        ] },
        { name: 'Legs B', emoji: '🧡', color: '#FF9F0A', muscles: ['pierna', 'abdomen'], exercises: [
          ['Sentadilla búlgara', T(3, '10-12', 90)], ['Hip thrust', T(4, '8-12', 90)],
          ['Curl femoral acostado', T(3, '10-12', 60)], ['Elevación de talones sentado', T(4, '15-20', 45)],
          ['Crunch en polea', T(3, '12-15', 45)],
        ] },
      ],
    },
    {
      name: 'Torso Pierna (4 días)',
      days: [
        { name: 'Torso A', emoji: '💪', color: '#0A84FF', muscles: ['pecho', 'espalda', 'hombro'], exercises: [
          ['Press banca con barra', T(4, '8-12', 90)], ['Remo con barra', T(4, '8-12', 90)],
          ['Press de hombros con mancuernas', T(3, '8-12', 90)], ['Jalón al pecho', T(3, '10-12', 90)],
          ['Elevaciones laterales', T(3, '12-15', 60)],
        ] },
        { name: 'Pierna A', emoji: '🦵', color: '#FF9F0A', muscles: ['pierna'], exercises: [
          ['Sentadilla con barra', T(4, '8-12', 120)], ['Peso muerto rumano', T(3, '8-12', 90)],
          ['Prensa de pierna', T(3, '10-12', 90)], ['Elevación de talones de pie', T(4, '12-15', 45)],
        ] },
        { name: 'Torso B', emoji: '🏋️', color: '#0A84FF', muscles: ['pecho', 'espalda', 'biceps', 'triceps'], exercises: [
          ['Press inclinado con mancuernas', T(4, '8-12', 90)], ['Dominadas', T(4, '6-10', 90)],
          ['Cruce de poleas', T(3, '12-15', 60)], ['Curl con barra', T(3, '8-12', 60)],
          ['Extensión con cuerda', T(3, '10-12', 60)],
        ] },
        { name: 'Pierna B', emoji: '🦿', color: '#FF9F0A', muscles: ['pierna', 'abdomen'], exercises: [
          ['Sentadilla búlgara', T(3, '10-12', 90)], ['Hip thrust', T(4, '8-12', 90)],
          ['Curl femoral sentado', T(3, '10-12', 60)], ['Rueda abdominal', T(3, '10-12', 60)],
        ] },
      ],
    },
  ],
  fuerza: [
    {
      name: 'Fuerza 5x5 (3 días)',
      days: [
        { name: 'Día A', emoji: '🔴', color: '#FF453A', muscles: ['pierna', 'pecho', 'espalda'], exercises: [
          ['Sentadilla con barra', T(5, '5', 180)], ['Press banca con barra', T(5, '5', 180)],
          ['Remo con barra', T(5, '5', 180)],
        ] },
        { name: 'Día B', emoji: '🟥', color: '#FF453A', muscles: ['pierna', 'hombro', 'espalda'], exercises: [
          ['Sentadilla con barra', T(5, '5', 180)], ['Press militar con barra', T(5, '5', 180)],
          ['Peso muerto', T(3, '3-5', 240)],
        ] },
        { name: 'Día C', emoji: '❤️', color: '#FF453A', muscles: ['pierna', 'pecho', 'espalda'], exercises: [
          ['Sentadilla con barra', T(5, '5', 180)], ['Press banca con barra', T(5, '5', 180)],
          ['Dominadas', T(3, '5-8', 180)],
        ] },
      ],
    },
  ],
  grasa: [
    {
      name: 'Full Body + Cardio (3 días)',
      days: [
        { name: 'Full Body A', emoji: '🟢', color: '#30D158', muscles: ['pecho', 'espalda', 'pierna'], exercises: [
          ['Sentadilla con barra', T(3, '12-15', 45)], ['Press banca con barra', T(3, '12-15', 45)],
          ['Remo en polea baja', T(3, '12-15', 45)], ['Plancha', T(3, '30-60s', 45)],
          ['Correr en cinta', T(1, '20 min', 0)],
        ] },
        { name: 'Full Body B', emoji: '💚', color: '#30D158', muscles: ['pierna', 'hombro', 'abdomen'], exercises: [
          ['Prensa de pierna', T(3, '12-15', 45)], ['Press de hombros con mancuernas', T(3, '12-15', 45)],
          ['Jalón al pecho', T(3, '12-15', 45)], ['Giro ruso', T(3, '15-20', 45)],
          ['Bicicleta estática', T(1, '20 min', 0)],
        ] },
        { name: 'Full Body C', emoji: '🍀', color: '#30D158', muscles: ['pierna', 'pecho', 'espalda'], exercises: [
          ['Zancadas con mancuernas', T(3, '12-15', 45)], ['Press plano con mancuernas', T(3, '12-15', 45)],
          ['Remo con mancuerna a una mano', T(3, '12-15', 45)], ['Crunch abdominal', T(3, '15-20', 45)],
          ['Elíptica', T(1, '20 min', 0)],
        ] },
      ],
    },
  ],
  resistencia: [
    {
      name: 'Híbrido fuerza + running (4 días)',
      days: [
        { name: 'Fuerza tren inferior', emoji: '🦵', color: '#40C8E0', muscles: ['pierna', 'abdomen'], exercises: [
          ['Sentadilla con barra', T(3, '6-8', 120)], ['Peso muerto rumano', T(3, '8-10', 90)],
          ['Zancadas con mancuernas', T(3, '10-12', 60)], ['Plancha', T(3, '45-60s', 45)],
        ] },
        { name: 'Carrera suave', emoji: '🏃', color: '#40C8E0', muscles: ['cardio'], exercises: [
          ['Correr en cinta', T(1, '30-40 min', 0)],
        ] },
        { name: 'Fuerza tren superior', emoji: '💪', color: '#40C8E0', muscles: ['pecho', 'espalda', 'hombro'], exercises: [
          ['Press banca con barra', T(3, '6-8', 120)], ['Dominadas', T(3, '6-10', 90)],
          ['Press militar con barra', T(3, '8-10', 90)], ['Face pull', T(3, '12-15', 60)],
        ] },
        { name: 'Carrera larga o series', emoji: '⚡', color: '#40C8E0', muscles: ['cardio'], exercises: [
          ['Correr en cinta', T(1, '45-60 min', 0)],
        ] },
      ],
    },
  ],
  recomposicion: [
    {
      name: 'Upper Lower (4 días) + cardio ligero',
      days: [
        { name: 'Upper A', emoji: '🟣', color: '#BF5AF2', muscles: ['pecho', 'espalda', 'hombro'], exercises: [
          ['Press banca con barra', T(4, '8-12', 90)], ['Remo con barra', T(4, '8-12', 90)],
          ['Press de hombros con mancuernas', T(3, '8-12', 90)], ['Elevaciones laterales', T(3, '12-15', 60)],
        ] },
        { name: 'Lower A', emoji: '💜', color: '#BF5AF2', muscles: ['pierna'], exercises: [
          ['Sentadilla con barra', T(4, '8-12', 120)], ['Peso muerto rumano', T(3, '8-12', 90)],
          ['Extensión de cuádriceps', T(3, '12-15', 60)], ['Elevación de talones de pie', T(4, '12-15', 45)],
        ] },
        { name: 'Upper B', emoji: '🔮', color: '#BF5AF2', muscles: ['espalda', 'pecho', 'biceps', 'triceps'], exercises: [
          ['Jalón al pecho', T(4, '8-12', 90)], ['Press inclinado con mancuernas', T(3, '8-12', 90)],
          ['Curl con barra', T(3, '10-12', 60)], ['Extensión con cuerda', T(3, '10-12', 60)],
        ] },
        { name: 'Lower B + cardio', emoji: '✨', color: '#BF5AF2', muscles: ['pierna', 'cardio'], exercises: [
          ['Hip thrust', T(4, '8-12', 90)], ['Sentadilla búlgara', T(3, '10-12', 90)],
          ['Curl femoral acostado', T(3, '10-12', 60)], ['Caminata en cinta', T(1, '20 min', 0)],
        ] },
      ],
    },
  ],
}

// "Caminata en cinta" no existe en el seed: se mapea a "Correr en cinta"
export const NAME_FALLBACKS = { 'Caminata en cinta': 'Correr en cinta' }
