#main_5.py
import pandas as pd
import openpyxl
from excel_data_handler import (
    cargar_datos_excel,
    obtener_areas_disponibles,
    cargar_lineas_produccion_area,
    cargar_modelos_area,
    cargar_volumenes_produccion,
    escribir_resultados_excel
)

class LineaProduccion:
    def __init__(self, nombre, tiempo_disponible, eficiencia, area):
        self.nombre = nombre
        self.tiempo_disponible = tiempo_disponible
        self.eficiencia = eficiencia
        self.area = area
        self.modelos = {}
        self.familias = {}
        self.tiempo_utilizado = 0
        self.piezas_anuales = {}
        self.segundos_anuales = {}

    def agregar_modelo(self, familia, modelo, info_modelo, cantidad_total):
        tiempo_ciclo_total = sum(
            (pcb_info.get('Top', {}).get('tiempo_ciclo', 0) + pcb_info.get('Bottom', {}).get('tiempo_ciclo', 0)) * 
            pcb_info.get('Top', {}).get('cantidad_por_producto', 1) #Lado top da la señal de cuantas piezas x producto.
            for pcb_info in info_modelo['pcbs'].values()
        )
        tiempo_ciclo_ajustado = tiempo_ciclo_total / info_modelo['eficiencia']
        
        tiempo_disponible = self.tiempo_disponible - self.tiempo_utilizado
        piezas_posibles = min(cantidad_total, int(tiempo_disponible / tiempo_ciclo_ajustado))
        
        if piezas_posibles > 0:
            tiempo_utilizado = piezas_posibles * tiempo_ciclo_ajustado
            self.tiempo_utilizado += tiempo_utilizado
            
            if modelo in self.modelos:
                self.modelos[modelo] += piezas_posibles
            else:
                self.modelos[modelo] = piezas_posibles
            
            if familia in self.familias:
                self.familias[familia] += piezas_posibles
            else:
                self.familias[familia] = piezas_posibles
            
            self.piezas_anuales[familia] = piezas_posibles
            self.segundos_anuales[familia] = piezas_posibles * tiempo_ciclo_total
            
            print(f"    Tiempo utilizado en {self.nombre}: {self.tiempo_utilizado:.2f} / {self.tiempo_disponible} segundos")
            return piezas_posibles
        return 0

def obtener_volumen_anual(volumenes, familia, ano_index):
    for modelo in volumenes['modelos']:
        if modelo['Familia'] == familia:
            if ano_index < len(modelo['volumenes_anuales']):
                volumen = modelo['volumenes_anuales'][ano_index]
                if volumen is None:
                    print(f"Advertencia: Volumen es None para la familia {familia} en el año {volumenes['anos_produccion'][ano_index]}")
                    return None
                return volumen
            else:
                print(f"Advertencia: No hay datos para el año {volumenes['anos_produccion'][ano_index]} de la Familia {familia}")
                return None
    print(f"Advertencia: Familia {familia} no encontrada en los datos de volúmenes")
    return None

def crear_lineas_produccion(lineas_data):
    return {linea['nombre']: LineaProduccion(
        nombre=linea['nombre'],
        tiempo_disponible=linea['tiempo_disponible'],
        eficiencia=linea['eficiencia'],
        area=linea.get('area', 'ICT')  # Obtener el área del diccionario de línea
    ) for linea in lineas_data}

def obtener_modelos(modelos_data, volumenes):
    modelos_por_ano = {}
    for ano_index, ano in enumerate(volumenes['anos_produccion']):
        modelos = {}
        for familia, info in modelos_data.items():
            volumen_anual = obtener_volumen_anual(volumenes, familia, ano_index)
            if volumen_anual is not None and volumen_anual > 0:
                tiempo_ciclo_total = sum(
                    (pcb_info.get('Top', {}).get('tiempo_ciclo', 0) + pcb_info.get('Bottom', {}).get('tiempo_ciclo', 0)) * 
                    pcb_info.get('Top', {}).get('cantidad_por_producto', 1)
                    for pcb_info in info['pcbs'].values()
                )
                dias_operacion = next((m['dias_operacion_anual'] for m in volumenes['modelos'] if m['Familia'] == familia), 365)
                modelos[familia] = {
                    'volumen_anual': volumen_anual,
                    'cantidad_total': volumen_anual // dias_operacion,  # Volumen diario
                    'lineas_compatibles': info['lineas_compatibles'],
                    'pcbs': info['pcbs'],
                    'nombre': info['nombre'],
                    'prioridad': info['prioridad'],
                    'tiempo_ciclo_total': tiempo_ciclo_total,
                    'dias_operacion_anual': dias_operacion,
                    'eficiencia': info['eficiencia']
                }
            elif volumen_anual is None:
                print(f"Advertencia: Volumen anual es None para la familia {familia} en el año {ano}")
            elif volumen_anual == 0:
                print(f"Información: Volumen anual es 0 para la familia {familia} en el año {ano}")
        if modelos:
            modelos_por_ano[ano] = modelos
        else:
            print(f"Advertencia: No hay datos de producción para el año {ano}")

    return modelos_por_ano

def distribuir_modelos(lineas_data, modelos_por_ano):
    resultados_por_ano = {}
    for ano, modelos in modelos_por_ano.items():
        print(f"\nDistribuyendo modelos para el año {ano}")
        lineas = crear_lineas_produccion(lineas_data)
        modelos_ordenados = sorted(modelos.items(), key=lambda x: x[1].get('prioridad', float('inf')))

        for familia, info in modelos_ordenados:
            prioridad = info.get('prioridad', 'No definida')
            print(f"\nDistribuyendo familia {familia} (Total: {info['cantidad_total']}, Prioridad: {prioridad}):")
            print(f"Líneas compatibles: {info['lineas_compatibles']}")
            lineas_compatibles = [linea for nombre, linea in lineas.items() if nombre in info['lineas_compatibles']]
            
            # Primera pasada: distribuir en líneas compatibles
            for linea in lineas_compatibles:
                if info['cantidad_total'] > 0:
                    piezas_producidas = linea.agregar_modelo(familia, familia, info, info['cantidad_total'])  # Cambiado info['nombre'] a familia
                    info['cantidad_total'] -= piezas_producidas
                    print(f"  - Agregadas {piezas_producidas} piezas de la familia {familia} en {linea.nombre}")
            
            # Segunda pasada: distribuir piezas restantes
            if info['cantidad_total'] > 0:
                print(f"\nRedistribuyendo piezas restantes de {familia} (Restantes: {info['cantidad_total']}):")
                for linea in lineas_compatibles:
                    if linea.tiempo_disponible > linea.tiempo_utilizado:
                        piezas_producidas = linea.agregar_modelo(familia, familia, info, info['cantidad_total'])  # Cambiado info['nombre'] a familia
                        info['cantidad_total'] -= piezas_producidas
                        print(f"  - Agregadas {piezas_producidas} piezas adicionales de {familia} en {linea.nombre}")
                    if info['cantidad_total'] == 0:
                        break

        resultados_por_ano[ano] = lineas
    
    return resultados_por_ano

def generar_tabla_resultados(resultados_por_ano, modelos_por_ano, orden_lineas):
    def normalizar_nombre(nombre):
        return nombre.strip()

    df_final = pd.DataFrame({'Línea': [linea['nombre'] for linea in orden_lineas]})

    for ano, lineas in resultados_por_ano.items():
        data = []
        for linea_info in orden_lineas:
            linea_nombre = linea_info['nombre']
            linea = lineas.get(linea_nombre)
            if linea:
                row = {
                    f'{ano} Tiempo Utilizado': round(linea.tiempo_utilizado),
                    f'{ano} Utilización (%)': (linea.tiempo_utilizado / linea.tiempo_disponible) * 100
                }
                total_piezas = 0
                total_segundos = 0
                for familia, info in modelos_por_ano[ano].items():
                    dias_operacion = info['dias_operacion_anual']
                    familia_normalizada = normalizar_nombre(familia)
                    piezas = segundos = 0
                    for linea_familia, linea_piezas in linea.piezas_anuales.items():
                        if normalizar_nombre(linea_familia) == familia_normalizada:
                            piezas = linea_piezas * dias_operacion
                            segundos = linea.segundos_anuales[linea_familia] * dias_operacion
                            break
                    row[f'{ano} {familia} Piezas Anuales'] = piezas
                    row[f'{ano} {familia} Segundos Anuales'] = segundos
                    total_piezas += piezas
                    total_segundos += segundos
                row[f'{ano} Total Piezas Anuales'] = total_piezas
                row[f'{ano} Total Segundos Anuales'] = total_segundos
            else:
                row = {f'{ano} {col}': 0 for col in ['Tiempo Utilizado', 'Utilización (%)', 'Total Piezas Anuales', 'Total Segundos Anuales']}
                for familia in modelos_por_ano[ano]:
                    row[f'{ano} {familia} Piezas Anuales'] = 0
                    row[f'{ano} {familia} Segundos Anuales'] = 0
            data.append(row)
        df_ano = pd.DataFrame(data)
        df_final = pd.concat([df_final, df_ano], axis=1)

    # Ordenar columnas
    columnas = ['Línea']
    for ano in resultados_por_ano.keys():
        columnas.extend([f'{ano} Tiempo Utilizado', f'{ano} Utilización (%)'])
        
        # Agrupar modelos por familia
        familias = {}
        for modelo, info in modelos_por_ano[ano].items():
            familia = info['nombre']  # Cambiado de 'familia' a 'nombre'
            familias.setdefault(familia, []).append(modelo)
        
        # Añadir columnas de piezas anuales agrupadas por familia
        for familia in sorted(familias):
            for modelo in sorted(familias[familia]):
                columnas.append(f'{ano} {modelo} Piezas Anuales')
        
        # Añadir columnas de segundos anuales agrupadas por familia
        for familia in sorted(familias):
            for modelo in sorted(familias[familia]):
                columnas.append(f'{ano} {modelo} Segundos Anuales')
        
        columnas.extend([f'{ano} Total Piezas Anuales', f'{ano} Total Segundos Anuales'])
    
    df_final = df_final.reindex(columns=columnas)
    df_final = df_final.fillna(0)

    # Formatear columnas
    for col in df_final.columns:
        if 'Utilización' in col:
            df_final[col] = df_final[col].map('{:.2f}%'.format)
        elif 'Tiempo' in col or 'Piezas' in col or 'Segundos' in col:
            df_final[col] = df_final[col].astype(int)

    # Crear la tabla de resumen
    resumen = {'Línea': [linea['nombre'] for linea in orden_lineas]}
    anos = sorted(resultados_por_ano.keys())
    
    # Añadir columnas de Total Piezas Anuales
    for ano in anos:
        resumen[f'{ano} Total Piezas Anuales'] = df_final[f'{ano} Total Piezas Anuales']
    
    # Añadir columnas de Total Segundos Anuales
    for ano in anos:
        resumen[f'{ano} Total Segundos Anuales'] = df_final[f'{ano} Total Segundos Anuales']
    
    # Añadir columnas de Utilización
    for ano in anos:
        resumen[f'{ano} Utilización (%)'] = df_final[f'{ano} Utilización (%)']

    df_resumen = pd.DataFrame(resumen)

    # Reordenar las columnas
    columnas_resumen = ['Línea']
    for ano in anos:
        columnas_resumen.append(f'{ano} Total Piezas Anuales')
    for ano in anos:
        columnas_resumen.append(f'{ano} Total Segundos Anuales')
    for ano in anos:
        columnas_resumen.append(f'{ano} Utilización (%)')
    
    df_resumen = df_resumen.reindex(columns=columnas_resumen)

    return df_final, df_resumen

def main():
    # Nombre del archivo Excel
    archivo_excel = 'datos_produccion.xlsx'

    # Carga el archivo Excel
    wb = cargar_datos_excel(archivo_excel)
    
    # Obtener áreas disponibles
    areas = obtener_areas_disponibles(wb['Lineas_Produccion'])
    print(f"\nÁreas identificadas: {areas}")
    
    # Procesar cada área
    for area in areas:
        print(f"\n{'='*50}")
        print(f"Procesando área: {area}")
        print(f"{'='*50}")
        
        # Cargar datos específicos del área
        lineas_area = cargar_lineas_produccion_area(wb['Lineas_Produccion'], area)
        modelos_area = cargar_modelos_area(wb['Modelos'], area)
        volumenes = cargar_volumenes_produccion(wb['Volumenes_Produccion'])
        
        # Mostrar información de la carga
        print(f"\nLíneas cargadas para {area}:")
        for linea in lineas_area:
            print(f"  - {linea['nombre']}")
        
        print(f"\nModelos cargados para {area}:")
        for familia in modelos_area:
            print(f"  - {familia}")
        
        # Obtener modelos por año para el área
        modelos_por_ano = obtener_modelos(modelos_area, volumenes)
        print(f"\nAños de producción procesados:", list(modelos_por_ano.keys()))
        
        # Distribuir modelos en las líneas del área
        resultados_por_ano = distribuir_modelos(lineas_area, modelos_por_ano)
        
        # Generar tabla de resultados y resumen para el área
        df_resultados, df_resumen = generar_tabla_resultados(
            resultados_por_ano, 
            modelos_por_ano, 
            lineas_area
        )
        
        # Verificación final
        columnas_no_deseadas = [col for col in df_resultados.columns if 'Dias Operacion Anual' in col]
        if columnas_no_deseadas:
            print(f"\nAdvertencia: Se encontraron columnas no deseadas para {area}:")
            print(columnas_no_deseadas)
            df_resultados = df_resultados.drop(columns=columnas_no_deseadas)
        
        # Escribir resultados específicos del área
        escribir_resultados_excel(
            df_resultados,
            df_resumen,
            archivo_excel,
            f'Resultados_{area}'
        )
        
        print(f"\nProcesamiento de {area} completado")
        print(f"Resultados guardados en hoja 'Resultados_{area}'")
    
    print(f"\n{'='*50}")
    print("Procesamiento de todas las áreas completado")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()