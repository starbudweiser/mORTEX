// Lot 18 : anglais → [espagnol, italien]
const SYM_ES =
  "Parece que los enlaces simbólicos no funcionan entre tu carpeta de preparación y la del juego. En Windows, solo funcionan en unidades NTFS";
const SYM_IT =
  "Sembra che i collegamenti simbolici non funzionino tra la cartella di preparazione e quella del gioco. Su Windows funzionano solo su unità NTFS";
const LINK_ES = (u) =>
  `El enlace no se creó para esta cuenta (${u}). Debes iniciar sesión en nexusmods.com con la misma cuenta que usas en Vortex.`;
const LINK_IT = (u) =>
  `Il link non è stato creato per questo account (${u}). Devi accedere a nexusmods.com con lo stesso account che usi in Vortex.`;
export default {
  "Deploys mods by setting symlinks in the destination directory. This is run as administrator and requires your permission every time we deploy.":
    [
      "Despliega los mods con enlaces simbólicos en la carpeta de destino. Se ejecuta como administrador y pide tu permiso en cada despliegue.",
      "Distribuisce le mod con collegamenti simbolici nella cartella di destinazione. Viene eseguito come amministratore e chiede il permesso a ogni distribuzione.",
    ],
  "Failed to write to disk. If you use a removable media or a network drive, the connection may be unstable. Please try resuming once you checked.":
    [
      "No se pudo escribir en el disco. Si usas un soporte extraíble o una unidad de red, la conexión puede ser inestable. Reanuda tras comprobarlo.",
      "Impossibile scrivere sul disco. Se usi un supporto rimovibile o un'unità di rete, la connessione potrebbe essere instabile. Riprendi dopo aver controllato.",
    ],
  "It appears symbolic links aren't supported between your mod staging folder and game folder. On Windows, symbolic links only work on NTFS drives":
    [SYM_ES, SYM_IT],
  "It appears symbolic links aren't supported between your mod staging folder and game folder. On Windows, symbolic links only work on NTFS drives.":
    [SYM_ES + ".", SYM_IT + "."],
  "Please follow the instructions in the .NET installer. If you can't see the installer window, please check if it's hidden behind another window.":
    [
      "Sigue las instrucciones del instalador de .NET. Si no ves su ventana, comprueba si está detrás de otra.",
      "Segui le istruzioni del programma di installazione di .NET. Se non vedi la finestra, controlla che non sia dietro un'altra.",
    ],
  "Sorry, due to large amount of feedback we receive we can't accept feedback from older versions since the issue may already have been addressed.":
    [
      "Lo sentimos: por el volumen de comentarios, no aceptamos los de versiones antiguas, ya que el problema puede estar resuelto.",
      "Spiacenti: per il volume di feedback non accettiamo quelli delle versioni precedenti, il problema potrebbe essere già risolto.",
    ],
  "These plugins could not be parsed by LOOT and were skipped so the rest of your load order could still sort. Reinstall or remove them to fix it:":
    [
      "LOOT no pudo analizar estos plugins y los omitió para poder ordenar el resto. Reinstálalos o quítalos para corregirlo:",
      "LOOT non ha potuto analizzare questi plugin e li ha saltati per ordinare il resto. Reinstallali o rimuovili per risolvere:",
    ],
  "This mod was not installed completely, most likely the installation got interrupted before. You should delete it now and then install it again.":
    [
      "Este mod no se instaló por completo, seguramente porque la instalación se interrumpió. Elimínalo y vuelve a instalarlo.",
      "Questa mod non è stata installata completamente, probabilmente per un'interruzione. Eliminala e reinstallala.",
    ],
  "The directory structure for downloads was changed so we need to move them. Please note: there will be no progress indication, please be patient.":
    [
      "La estructura de carpetas de descargas cambió y hay que moverlas. No habrá indicador de progreso, ten paciencia.",
      "La struttura delle cartelle dei download è cambiata e vanno spostati. Non ci sarà indicazione di avanzamento, abbi pazienza.",
    ],
  "The extension requires a restart to complete the UDF setup. The extension will now exit - please re-activate it via the games page or dashboard.":
    [
      "La extensión debe reiniciarse para completar la configuración de la UDF. Se cerrará: vuelve a activarla desde la página de juegos o el panel.",
      "L'estensione deve riavviarsi per completare la configurazione della UDF. Ora si chiuderà: riattivala dalla pagina dei giochi o dal pannello.",
    ],
  "The link was not created for this account ({{userName}}). You have to be logged into nexusmods.com with the same account that you use in Vortex.":
    [LINK_ES("{{userName}}"), LINK_IT("{{userName}}")],
  "The link was not created for this account ({{ userName }}). You have to be logged into nexusmods.com with the same account that you use in Vortex.":
    [LINK_ES("{{ userName }}"), LINK_IT("{{ userName }}")],
  "This mod contains a large number of files, calculating checksums for each may take a while, but without them the report is slightly less useful.":
    [
      "Este mod tiene muchos archivos: calcular sus sumas de comprobación puede tardar, pero sin ellas el informe es algo menos útil.",
      "Questa mod contiene molti file: calcolarne i checksum può richiedere tempo, ma senza il rapporto è un po' meno utile.",
    ],
  "If checked, plugins you add to the game directory outside mORTEX (e.g. when you create one with the Creation Kit) will be enabled automatically.":
    [
      "Si se marca, los plugins que añadas a la carpeta del juego fuera de mORTEX (p. ej. al crearlos con el Creation Kit) se activarán automáticamente.",
      "Se selezionata, i plugin aggiunti alla cartella del gioco fuori da mORTEX (es. creati con il Creation Kit) verranno attivati automaticamente.",
    ],
  "The direct download URL for this file is not valid or didn't lead to a file. This may be a setup error in the dependency or the file has been moved.":
    [
      "La URL de descarga directa no es válida o no lleva a un archivo. Puede ser un error de configuración de la dependencia o el archivo se movió.",
      "L'URL di download diretto non è valido o non porta a un file. Può essere un errore di configurazione della dipendenza o il file è stato spostato.",
    ],
  "Downloading failed due to an I/O error (either network or disk access). This is very likely a temporary problem, please try resuming at a later time.":
    [
      "La descarga falló por un error de E/S (red o disco). Muy probablemente sea temporal; intenta reanudarla más tarde.",
      "Download non riuscito per un errore di I/O (rete o disco). Molto probabilmente è temporaneo: prova a riprenderlo più tardi.",
    ],
  "Mods need to be in an installed state in order to add them to a collection. If the mod you want to add is not in this list, make sure it's installed.":
    [
      "Los mods deben estar instalados para añadirlos a una colección. Si el que buscas no está en la lista, asegúrate de que esté instalado.",
      "Le mod devono essere installate per aggiungerle a una collezione. Se quella che cerchi non è nell'elenco, assicurati che sia installata.",
    ],
  "The option to \"bundle\" already bundles the edited files, storing the edits separately would not be useful as they can't and don't have to be applied.":
    [
      "La opción «incluir» ya incluye los archivos editados; guardar los cambios aparte no serviría, ya que no se pueden ni hace falta aplicarlos.",
      "L'opzione «includi» include già i file modificati; salvare le modifiche a parte non servirebbe, perché non si possono né si devono applicare.",
    ],
  "This mod is missing identification information. Without this some features like checking for updates or adding this mod to collections will not work.":
    [
      "A este mod le falta información de identificación. Sin ella, funciones como buscar actualizaciones o añadirlo a colecciones no funcionarán.",
      "A questa mod mancano le informazioni di identificazione. Senza di esse, funzioni come cercare aggiornamenti o aggiungerla alle collezioni non funzioneranno.",
    ],
  "You have disabled Cross-ModType conflict detection on your system. Any conflicts across modtypes will have to be resolved manually outside of Vortex.":
    [
      "Desactivaste la detección de conflictos entre tipos de mod. Esos conflictos tendrán que resolverse a mano fuera de Vortex.",
      "Hai disattivato il rilevamento dei conflitti tra tipi di mod. Questi conflitti andranno risolti a mano fuori da Vortex.",
    ],
  'Failed to read pak. Please make sure you are using the latest version of LSLib by using the "Re-install LSLib/Divine" toolbar button on the Mods page.':
    [
      "No se pudo leer el pak. Asegúrate de usar la última versión de LSLib con el botón «Reinstalar LSLib/Divine» de la página Mods.",
      "Impossibile leggere il pak. Assicurati di usare l'ultima versione di LSLib con il pulsante «Reinstalla LSLib/Divine» della pagina Mod.",
    ],
  'You have exceeded the daily or hourly rate limit. Visit "help.nexusmods.com" and search for "Rate limit" for more information. Please try again later.':
    [
      "Superaste el límite de solicitudes diario u horario. Busca «Rate limit» en «help.nexusmods.com» para más información. Inténtalo más tarde.",
      "Hai superato il limite di richieste giornaliero o orario. Cerca «Rate limit» su «help.nexusmods.com» per maggiori informazioni. Riprova più tardi.",
    ],
  "This directory doesn't appear to contain the game.\nUsually you need to select the top-level game directory, containing the following files:\n{{ files }}":
    [
      "Esta carpeta no parece contener el juego.\nNormalmente hay que elegir la carpeta principal del juego, que contiene estos archivos:\n{{ files }}",
      "Questa cartella non sembra contenere il gioco.\nDi solito va scelta la cartella principale del gioco, che contiene questi file:\n{{ files }}",
    ],
  "This will enable all mods that were enabled for the last deployment and disable all that weren't. It doesn't revert anything else like mod order rules.":
    [
      "Activará los mods que estaban activados en el último despliegue y desactivará el resto. No revierte nada más, como las reglas de orden.",
      "Attiverà le mod attive all'ultima distribuzione e disattiverà le altre. Non annulla nient'altro, come le regole di ordinamento.",
    ],
  "Download the latest meta information about your installed and owned collections. This will reset local changes to names of collections in your workshop.":
    [
      "Descarga los metadatos más recientes de tus colecciones instaladas y propias. Restablecerá los cambios locales de nombres en tu workshop.",
      "Scarica i metadati più recenti delle collezioni installate e tue. Ripristinerà le modifiche locali ai nomi nel tuo workshop.",
    ],
  "Please check your internet connection or, if you are a premium member, try a different preferred download location within your account´s Site Preferences":
    [
      "Comprueba tu conexión a internet o, si eres Premium, prueba otra ubicación de descarga preferida en las preferencias del sitio de tu cuenta",
      "Controlla la connessione a internet o, se sei Premium, prova un'altra posizione di download preferita nelle preferenze del sito del tuo account",
    ],
  "The reason this deployment method is unavailable has changed since the notification was produced. This indicates a random or temporary factor affecting it.":
    [
      "El motivo por el que este método no está disponible cambió desde la notificación. Indica un factor aleatorio o temporal.",
      "Il motivo per cui questo metodo non è disponibile è cambiato dopo la notifica. Indica un fattore casuale o temporaneo.",
    ],
  "You can not put mods into the vortex application directory. This directory gets removed during updates so you would lose all your files on the next update.":
    [
      "No puedes guardar mods en la carpeta de la aplicación Vortex. Se borra al actualizar, así que perderías todos tus archivos.",
      "Non puoi mettere le mod nella cartella dell'applicazione Vortex. Viene eliminata con gli aggiornamenti e perderesti tutti i file.",
    ],
  'Failed to retrieve categories from server because network address "{{host}}" could not be resolved. This is often a temporary error, please try again later.':
    [
      "No se pudieron obtener las categorías porque no se pudo resolver la dirección «{{host}}». Suele ser temporal, inténtalo más tarde.",
      "Impossibile ottenere le categorie perché l'indirizzo «{{host}}» non è stato risolto. Spesso è temporaneo, riprova più tardi.",
    ],
  'File content modified ("Save" will apply the changed file from the game folder permanently, "Revert" will restore the original file from the staging folder)':
    [
      "Contenido del archivo modificado («Guardar» aplica definitivamente el archivo de la carpeta del juego, «Revertir» restaura el original de la carpeta de preparación)",
      "Contenuto del file modificato («Salva» applica definitivamente il file della cartella del gioco, «Ripristina» recupera l'originale dalla cartella di preparazione)",
    ],
  "You can choose to either receive automatic updates only after they went through some community testing (Stable) or to always get the newest features (Beta).":
    [
      "Puedes recibir las actualizaciones solo tras pruebas de la comunidad (Estable) o tener siempre las últimas novedades (Beta).",
      "Puoi ricevere gli aggiornamenti solo dopo i test della comunità (Stabile) o avere sempre le ultime novità (Beta).",
    ],
  "Nexus Mods Links are now unhandled.\nTo have another application handle those links you have to go to that\napplication and enable handling of NXM links there.":
    [
      "Los enlaces de Nexus Mods ya no se gestionan.\nPara que otra aplicación los gestione, ve a esa\naplicación y activa allí la gestión de enlaces NXM.",
      "I link di Nexus Mods non sono più gestiti.\nPer farli gestire da un'altra applicazione, vai in quella\napplicazione e attiva lì la gestione dei link NXM.",
    ],
  '"Replicate" depends on files being unchanged from the originals in the archive. If you modified mod files (as Binary Patching implies), "Replicate" will fail.':
    [
      "«Replicar» necesita que los archivos no cambien respecto al original. Si modificaste archivos del mod (como implica el parcheo binario), fallará.",
      "«Replica» richiede che i file siano identici agli originali dell'archivio. Se hai modificato file della mod (come implica la patch binaria), non funzionerà.",
    ],
  "This plugin was created for the original Skyrim and may be incompatible with Skyrim Special Edition. This can cause unforseen problems during gameplay.":
    [
      "Este plugin se creó para el Skyrim original y puede ser incompatible con Skyrim Special Edition, lo que puede causar problemas inesperados.",
      "Questo plugin è stato creato per lo Skyrim originale e potrebbe non essere compatibile con Skyrim Special Edition, causando problemi imprevisti.",
    ],
  "Mods are copyright protected. Only bundle mods if you are sure you have the right to do so, e.g. if it's dynamically generated content or if it's your own mod.":
    [
      "Los mods tienen derechos de autor. Inclúyelos solo si tienes derecho a hacerlo, p. ej. si es contenido generado o tu propio mod.",
      "Le mod sono protette da copyright. Includile solo se ne hai il diritto, ad es. se è contenuto generato o una tua mod.",
    ],
};
