# compaction-indicator

> [!NOTE]
> **Nota del autor:** no sé programar. Este proyecto está hecho íntegramente con *vibe coding* (lo escriben agentes de IA bajo mi dirección y yo lo pruebo). También soy novato total en GitHub: tenlo en cuenta al leer el código, y si abres un issue o un pull request y tardo en responder (o no sé qué hacer con él), no es desidia — es que literalmente estoy aprendiendo a usar GitHub. Aun así, mi intención es compartir: como amante del software libre, quiero que cualquiera pueda usarlo, clonarlo y probarlo aunque su autor sea un novato.

Extensión para [pi](https://github.com/badlogic/pi-mono) (`@earendil-works/pi-coding-agent`) que añade un **contador de compactaciones** al footer de la TUI y alinea los estados de las extensiones en la tercera línea.

## Qué hace

### 1. Contador de compactaciones (`#N`)

Añade `#N` a la línea de estadísticas del footer, pegado a la derecha del porcentaje de contexto (justo después de `(auto)`):

```
model:…  43.2%/200k (auto)#2          …
```

El número `N` es la cantidad de compactaciones que ha tenido la sesión actual. Se colorea según umbrales:

| Valor | Color |
|-------|-------|
| `#0` – `#3` | dim (igual que el resto de la barra) |
| `#4` – `#6` | ámbar (mismo umbral que el contexto >70%) |
| `#7`+ | rojo (mismo umbral que el contexto >90%) |

Útil para saber de un vistazo cuánto se ha comprimido ya el contexto de la sesión y cuánto "ruido" puede haber acumulado el resumen.

### 2. Alineación de estados de extensión (3ª línea)

Como la extensión es la única dueña del footer, también reordena la tercera línea: los estados de extensión que empiezan por un **marcador de ancho cero** (`RIGHT_MARKER`) se pegan a la derecha y el resto se mantienen a la izquierda:

```
rol: experto                 📖 LIBRO ON
```

Para que otra extensión se alinee a la derecha, basta con que su estado empiece por el marcador `\u200B\u200B` (dos espacios de ancho cero, U+200B):

```ts
pi.ui.setStatus("mi-extension", "\u200B\u200B" + "MI ESTADO");
```

Si nadie usa el marcador, la línea queda exactamente como la genera pi. Si el conjunto no cabe, se recorta la parte izquierda para que el estado de la derecha nunca desaparezca.

## Cómo funciona

**No parchea nada de pi.** La extensión:

1. Importa el `FooterComponent` original de `@earendil-works/pi-coding-agent`.
2. Lo re-renderiza con un *shim* mínimo de sesión que reutiliza los datos que expone la API de extensiones (`ctx.getContextUsage()`, `ctx.sessionManager.getEntries()`, modelo, thinking level…).
3. Inyecta el indicador `#N` en la línea de stats (dentro del span de color cuando el contexto va en ámbar/rojo, compensando el padding para no desplazar el resto de la barra).
4. Reescribe la tercera línea para la alineación izq/der.

**Degradación elegante:** si en el futuro pi cambia el formato interno del footer, el indicador simplemente no aparece (se devuelve la línea original) y, si `setFooter` falla, queda el footer integrado de pi.

## Instalación

Copia `compaction-indicator.ts` a tu directorio de extensiones de pi:

```bash
# global (todas las sesiones)
cp compaction-indicator.ts ~/.pi/agent/extensions/

# o solo para un proyecto
cp compaction-indicator.ts <proyecto>/.pi-agent/extensions/
```

Si pi ya está en ejecución, recarga con `/reload` en la TUI.

### Requisito

pi con soporte de extensiones (`@earendil-works/pi-coding-agent`). La extensión importa `FooterComponent` de ese paquete y `truncateToWidth`/`visibleWidth` de `@earendil-works/pi-tui`, que pi resuelve automáticamente.

## Limitaciones conocidas

- El sufijo `(auto)` se muestra siempre: la API de extensiones de pi no expone el toggle de auto-compactación, así que no se puede reflejar su estado real.
- El contador cuenta entradas de tipo `compaction` en el historial de la sesión; si navegas por el árbol de sesión (`/tree`), refleja las entradas visibles en el historial actual.

## Estructura

```
compaction-indicator/
├── compaction-indicator.ts   # la extensión (un solo fichero)
└── README.md
```

## Licencia

AGPL-3.0-only — Copyright (C) 2026 dlazarus.

Este programa es software libre: puede redistribuirlo y/o modificarlo bajo los términos de la [GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.html) publicada por la Free Software Foundation (versión 3).

Se distribuye sin garantía de ningún tipo. Los trabajos derivados que se expongan a usuarios por una red deben publicar también su código fuente.
