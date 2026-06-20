Actúa como Lead Data Scientist y AI Sports Analyst. Se adjunta el reporte en PDF del partido.
ID del Partido: [EJEMPLO: J1-A-1]
Equipos: [EJEMPLO: Mexico vs South Africa]
Resultado Final: [EJEMPLO: 2-0]

Ejecuta lo siguiente de forma autónoma:
1. Extrae del PDF: Posesión, xG, Remates, Grandes Chances y Duelos.
2. Genera un Veredicto Híbrido (3 párrafos en inglés) analizando la justicia del resultado según la estadística vs la suerte.
3. Actualiza/Crea el archivo 'ai_match_insights.json' en esta carpeta agregando este análisis.
4. Usa el motor de Python para actualizar 'tracking_predicciones_2026.csv' y 'live_form_index.json' basándote en el resultado y castigando/premiando el ELO según el dominio mostrado en el xG.
5. SINCRONIZACIÓN CRÍTICA: Copia y sobrescribe exactamente esos 3 archivos de datos actualizados (CSV y JSONs) hacia la carpeta del frontend: 'C:\Users\Joshua Sánchez\Documents\proyectos\joshua-sanchez-ds'.