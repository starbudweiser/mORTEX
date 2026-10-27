// Lot 20 : anglais → [espagnol, italien]
const COPIED = (esF, itF) => [
  `¡La ${esF} se copió [b]correctamente[/b] al destino elegido!<br />Se canceló la limpieza de la ${esF} anterior.<br /><br />${esF[0].toUpperCase() + esF.slice(1)} anterior: [url]{{thePath}}[/url]`,
  `La ${itF} è stata copiata [b]correttamente[/b] nella destinazione scelta!<br />La pulizia della ${itF} precedente è stata annullata.<br /><br />${itF[0].toUpperCase() + itF.slice(1)} precedente: [url]{{thePath}}[/url]`,
];
export default {
  "This installer is (partially) unsupported as it's using functionality that hasn't been implemented yet. Please help us fix this by submitting an error report with a link to this mod.":
    [
      "Este instalador es (en parte) incompatible porque usa funciones aún no implementadas. Ayúdanos enviando un informe de error con un enlace a este mod.",
      "Questo programma di installazione è (in parte) non supportato perché usa funzioni non ancora implementate. Aiutaci inviando una segnalazione con un link a questa mod.",
    ],
  "This deployment method does nothing during deployment (although extensions may still do work during deployment). Only use for games that can be made to use mods directly from staging.":
    [
      "Este método no hace nada al desplegar (aunque las extensiones sí pueden actuar). Úsalo solo con juegos que puedan usar los mods directamente desde la carpeta de preparación.",
      "Questo metodo non fa nulla durante la distribuzione (anche se le estensioni possono agire). Usalo solo con giochi che usano le mod direttamente dalla cartella di preparazione.",
    ],
  "The deployment directory for some mod type(s) ({{ types }}) is unknown. Mods of these types will not be deployed. Maybe this/these type(s) require further configuration or external tools.":
    [
      "Se desconoce la carpeta de despliegue de algunos tipos de mod ({{ types }}). Esos mods no se desplegarán. Puede que necesiten más configuración o herramientas externas.",
      "La cartella di distribuzione di alcuni tipi di mod ({{ types }}) è sconosciuta. Queste mod non verranno distribuite. Potrebbero servire altre configurazioni o strumenti esterni.",
    ],
  "This is a regular plugin that could be turned into a light one (also known as an ESPfe). When you do this, it will no longer take up a spot in the load order while still working as usual.":
    [
      "Es un plugin normal que podría convertirse en ligero (ESPfe). Así dejaría de ocupar una posición en el orden de carga y seguiría funcionando igual.",
      "È un plugin normale che potrebbe diventare leggero (ESPfe). Così non occuperebbe più una posizione nell'ordine di caricamento e funzionerebbe come sempre.",
    ],
  "This will stop notifications about Vortex updates.\n\nThis is not recommended as important security and stability updates are released regularly.\n\nAre you sure you want to turn off updates?":
    [
      "Se dejarán de mostrar avisos de actualizaciones de Vortex.\n\nNo se recomienda: se publican con regularidad actualizaciones importantes de seguridad y estabilidad.\n\n¿Seguro que quieres desactivar las actualizaciones?",
      "Le notifiche degli aggiornamenti di Vortex verranno disattivate.\n\nNon è consigliato: escono regolarmente aggiornamenti importanti di sicurezza e stabilità.\n\nVuoi davvero disattivare gli aggiornamenti?",
    ],
  "You can't change the download folder to be the parent of the old folder. This is because the new download folder has to be empty and it isn't empty if it contains the old download folder.":
    [
      "La nueva carpeta de descargas no puede contener a la anterior: debe estar vacía, y no lo está si contiene la carpeta antigua.",
      "La nuova cartella dei download non può contenere quella precedente: deve essere vuota, e non lo è se contiene la vecchia cartella.",
    ],
  'To disable/enable an INI tweak, simply click on the button itself (in the status column). If needed, INI tweak can be removed by clicking the arrow next to the button and selecting "Remove"':
    [
      "Para activar o desactivar un ajuste INI, pulsa su botón (columna de estado). Para quitarlo, pulsa la flecha junto al botón y elige «Quitar»",
      "Per attivare o disattivare una modifica INI, fai clic sul suo pulsante (colonna di stato). Per rimuoverla, fai clic sulla freccia accanto e scegli «Rimuovi»",
    ],
  "Required: Select whether the user has to install the mod or whether it's an optional recommendation. Optional mods are presented last and the user is given the choice to install them or not.":
    [
      "Necesario: elige si el usuario debe instalar el mod o si es una recomendación opcional. Los opcionales se muestran al final y el usuario decide si los instala.",
      "Richiesta: scegli se l'utente deve installare la mod o se è un consiglio facoltativo. Le facoltative sono mostrate per ultime e l'utente sceglie se installarle.",
    ],
  "Some of the enabled mods either contain no files or all files they do contain are entirely overwritten by another mod. These redundant mods don't do any harm except slow down deployment a bit.":
    [
      "Algunos mods activados no tienen archivos o todos los suyos los sobrescribe otro mod. Estos mods redundantes no causan daño, solo ralentizan un poco el despliegue.",
      "Alcune mod attive non contengono file o tutti i loro file sono sovrascritti da un'altra mod. Queste mod ridondanti non fanno danni, rallentano solo un po' la distribuzione.",
    ],
  "This mod is a collective merge of setting files required by any/all menu mods the user has installed - please do not disable/remove unless all menu mods have been removed from your game first.":
    [
      "Este mod fusiona los archivos de ajustes que necesitan los mods de menú instalados; no lo desactives ni lo quites salvo que antes hayas quitado todos los mods de menú.",
      "Questa mod unisce i file di impostazioni richiesti dalle mod di menu installate: non disattivarla né rimuoverla finché non hai rimosso tutte le mod di menu.",
    ],
  "The mod id identifies a mod page on nexus mods. It helps us find the name, description, author, ... of a mod but with this id alone, we don't know which file exactly (version, variant) this is.":
    [
      "El ID del mod identifica una página de Nexus Mods. Nos ayuda a encontrar nombre, descripción, autor…, pero solo con él no sabemos qué archivo exacto (versión, variante) es.",
      "L'ID della mod identifica una pagina su Nexus Mods. Ci aiuta a trovare nome, descrizione, autore…, ma da solo non dice quale file esatto (versione, variante) sia.",
    ],
  'You have edit permissions for the collection "{{name}}", but you are not the owner.[br][/br]Would you like to clone it as your own collection, or contribute to the existing one?[br][/br][br][/br]':
    [
      "Puedes editar la colección «{{name}}», pero no eres su propietario.[br][/br]¿Quieres clonarla como colección propia o contribuir a la existente?[br][/br][br][/br]",
      "Puoi modificare la collezione «{{name}}», ma non ne sei il proprietario.[br][/br]Vuoi clonarla come tua o contribuire a quella esistente?[br][/br][br][/br]",
    ],
  'Dependency rules between your mods contain cycles, like "A after B" and "B after A". You need to remove one of the rules causing the cycle, otherwise your mods can\'t be applied in the right order.':
    [
      "Las reglas de dependencia entre tus mods contienen ciclos, como «A después de B» y «B después de A». Quita una de las reglas o tus mods no podrán aplicarse en el orden correcto.",
      "Le regole di dipendenza tra le mod contengono cicli, come «A dopo B» e «B dopo A». Rimuovi una delle regole, altrimenti le mod non potranno essere applicate nell'ordine giusto.",
    ],
  'The file "{{filePath}}" is stored on a cloud storage drive (Microsoft OneDrive) which is currently unavailable. Please check your internet connection and verify the service is running, then retry.':
    [
      "«{{filePath}}» está en una unidad en la nube (Microsoft OneDrive) que no está disponible. Comprueba tu conexión y que el servicio funcione, y vuelve a intentarlo.",
      "«{{filePath}}» si trova su un'unità cloud (Microsoft OneDrive) al momento non disponibile. Controlla la connessione e che il servizio sia attivo, poi riprova.",
    ],
  "The operation completed successfully, but the file could not be processed. This may be due to a temporary issue or a problem with the downloaded file. Please try again or check the file integrity.":
    [
      "La operación terminó, pero el archivo no se pudo procesar. Puede ser un problema temporal o del archivo descargado. Inténtalo de nuevo o comprueba su integridad.",
      "L'operazione è terminata, ma il file non è stato elaborato. Può essere un problema temporaneo o del file scaricato. Riprova o verifica l'integrità del file.",
    ],
  "The file id identifies a specific file. We need this to check for updates, to include mods in a collection and to correctly identify if you try to install a second copy of the same file for example.":
    [
      "El ID de archivo identifica un archivo concreto. Lo necesitamos para buscar actualizaciones, incluir mods en colecciones y detectar, por ejemplo, si instalas otra copia del mismo archivo.",
      "L'ID file identifica un file preciso. Serve per cercare aggiornamenti, includere mod nelle collezioni e capire, ad esempio, se installi una seconda copia dello stesso file.",
    ],
  "The exception you got indicates an out of memory situation. This can have different reasons, most commonly a system misconfiguration where it doesn't provide enough virtual memory for stable operation.":
    [
      "La excepción indica falta de memoria. Puede tener varias causas; la más común es una configuración del sistema que no ofrece suficiente memoria virtual.",
      "L'eccezione indica memoria esaurita. Può avere diverse cause; la più comune è una configurazione di sistema che non fornisce abbastanza memoria virtuale.",
    ],
  "The mods staging folder has been copied [b]successfully[/b] to your chosen destination!<br />Clean-up of the old staging folder has been cancelled.<br /><br />Old staging folder: [url]{{thePath}}[/url]":
    COPIED("carpeta de preparación", "cartella di preparazione"),
  "The downloads folder has been copied [b]successfully[/b] to your chosen destination!<br />Clean-up of the old downloads folder has been cancelled.<br /><br />Old downloads folder: [url]{{thePath}}[/url]":
    COPIED("carpeta de descargas", "cartella dei download"),
  "Operation can't continue because the disk is full. Please free up some space and click retry. Cancelling the transfer operation at this point will remove any changes and revert back to the previous state.":
    [
      "No se puede continuar porque el disco está lleno. Libera espacio y pulsa Reintentar. Cancelar ahora deshará los cambios y volverá al estado anterior.",
      "Impossibile continuare: il disco è pieno. Libera spazio e fai clic su Riprova. Annullare ora eliminerà le modifiche e tornerà allo stato precedente.",
    ],
  "To assist in the testing of INI configuration application - any enabled INI modification on this page will be applied to your own environment in the next deployment event; IF the collection mod is enabled.":
    [
      "Para facilitar las pruebas, las modificaciones INI activadas en esta página se aplicarán a tu propio entorno en el próximo despliegue, SI el mod de la colección está activado.",
      "Per facilitare i test, le modifiche INI attive in questa pagina verranno applicate al tuo ambiente alla prossima distribuzione, SE la mod della collezione è attiva.",
    ],
  'Due to a bug, the mod limit patch was not applied correctly. Please Uninstall/Remove your existing mod limit match mod entry in your mods page and re-apply the patch using the "Apply Mod Limit Patch" button.':
    [
      "Por un error, el parche de límite de mods no se aplicó bien. Desinstala o quita la entrada actual del parche en la página de mods y vuelve a aplicarlo con el botón «Aplicar parche de límite de mods».",
      "A causa di un bug, la patch del limite di mod non è stata applicata bene. Disinstalla o rimuovi la voce attuale nella pagina delle mod e riapplicala con il pulsante «Applica patch del limite di mod».",
    ],
};
