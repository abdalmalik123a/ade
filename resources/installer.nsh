; تعريب رسالة اشتراط ويندوز 64 بت في مثبّت NSIS (A15 — D95)
; electron-builder يعرّف x64WinRequired للعربية (1025) بنصّه الإنكليزيّ في messages.nsh، ويضمّن هذا الملفّ في الترويسة معه بترتيبٍ غير ثابت
; (مهامّ متوازية في NsisTarget.js computeCommonInstallerScriptHeader). وفي NSIS التعريف الأخير يغلب، والثاني يُحذَّر بـ6030 فيسقط البناء بـ-WX
; (D142، مُجرَّب على makensis 3.0.4.1: سطرٌ هنا في أعلى الملفّ جاء قبل messages.nsh فسقط البناء، ولو مرّ لغلب الإنكليزيّ).
; فالتعريف في customHeader: يُدرجه installer.nsi بعد الترويسة كلّها (للمثبّت وبرنامج الإزالة) فيغلب دائمًا، والتحذير عنده وحده مكتوم —
; ونجاح البناء بـ-WX دليل أنّه الأخير، إذ لا تحذير بعده.
!macro customHeader
  !pragma warning push
  !pragma warning disable 6030
  LangString x64WinRequired 1025 "يتطلّب تثبيت ديوان نظام ويندوز 64 بت (Windows 10 أو 11 — 64-bit)."
  !pragma warning pop
!macroend
