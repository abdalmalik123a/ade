# جرد موارد ديوان ورخصها قبل النشر

> D231 — ٣٠ ت١ ٢٠٢٦. جرد الأدلة المتاحة؛ ليس إقرارًا بحقوق محتوى يقدمه المكتب أو ضمان امتثال قانوني. لا موارد جديدة أضيفت.

## ما يتحقق منه الجرد

package.json يحزم out والاعتمادات التشغيلية وملفات القاعدة، ويضع models وtessdata وpacks والإشعارات بجوار البرنامج. يولد tools/make-notices.mjs الإشعارات من ملف القفل والحزم المحلية وموارد النماذج: **١٦٨ إدخالًا، منها ١٦٢ حزمة وإدخالات الموارد الستة**. الأسماء والإصدارات والنصوص في resources/THIRD-PARTY-NOTICES.txt؛ ملخص الواجهة في assets/notices.json. لا تعني عبارة «غير فارغة» في اختبار notices أن رخصة كل اعتماد حُسمت.

| الصنف المشحون | الدليل والرخصة المعلنة | ما يلزم عند التوزيع |
|---|---|---|
| حزم npm وElectron | package-lock.json وحزم node_modules، وإشعارات ١٦٢ إدخالًا | إبقاء نصوص الرخص وحقوق أصحابها؛ LICENSES.chromium.html وLICENSE من Electron في الحزمة النهائية؛ فحص المثبت الفعلي عند الإصدار |
| عشرة خطوط Fontsource | Amiri، Aref Ruqaa، Cairo، El Messiri، IBM Plex Sans، IBM Plex Sans Arabic، Lalezar، Noto Kufi Arabic، Noto Naskh Arabic، Reem Kufi؛ لكل حزمة LICENSE وOFL-1.1 | حمل الإشعارات؛ لا بيع الخط وحده؛ احترام الأسماء المحجوزة عند تعديل الخط، دون فرض رخصة الخط على الورقة التي طُبعت به |
| MODNet، ملف modnet-portrait-q8.onnx | resources/models/NOTICE.md وبصمته؛ Apache-2.0 في بطاقة Xenova/modnet | حفظ الرخصة ونسبة الأصل وبيان التحويل؛ المصدر أدناه |
| BiRefNet_lite-matting، ملف birefnet-lite-matting-q8.onnx | NOTICE وبطاقة صاحب الأوزان؛ MIT | حفظ نص MIT ونسبة الحقوق؛ التحويل المحلي موثق في NOTICE |
| YuNet، ملف face_detection_yunet_2023mar.onnx | رخصة مجلد النموذج الأصلي MIT وحقوق Shiqi Yu | إبقاء النص ونسبة صاحب الحقوق |
| RTMPose-t، ملف rtmpose-t-body7-256x192.onnx | NOTICE ومصدر OpenMMLab، Apache-2.0 | إبقاء الرخصة؛ التنبيه الموجود عن مجموعات التدريب يظل قائمًا، ولا يتحول هذا الجرد إلى شهادة بحقوق تلك المجموعات |
| بيانات OCR العربية والإنكليزية | ara.traineddata.gz وeng.traineddata.gz، Apache-2.0 في tessdata | حفظ الرخصة والإشعارات؛ بيانات اللغة محلية |
| كتالوج صور القاط المدمج | BUILTIN_SUITS=[]؛ مجلد assets/suits لا يحوي صورة، فيه .gitkeep فقط | لا تنسب صورًا إلى مكتبة مفتوحة بلا دليل. صحح D231 هذا الوصف في المولد والنصين مع حارس؛ الاستيراد والحزم لهما حقوق مستقلة |
| سبع حزم معاملات مدمجة | resources/packs/index.json والملفات السبعة؛ طابقت بصمة كل ملف فهرسه | الفهرس يثبت سلامة النسخة، لا ملكية النصوص أو موافقة الجهات؛ مراجعة المالك للمحتوى R06 باقية |
| صور/خطوط/شعارات/حزم يستوردها المكتب | ليست ترخيصًا يمنحه شراء ديوان | على من يوردها أن يثبت إذن استعمالها وتعديلها وتوزيعها؛ إتاحة الاستيراد أو التوقيع أو التشفير لا تمنح حقوق غيره |

حزم المثبت: civil-status (٤ نماذج/٤ كليشات)، court-petitions (٣/٣)، education (٦/٤)، general-requests (٣/٣)، higher-education (٥/٤)، housing-mukhtar (٣/٣)، school-letters (٤٥/٠). الفهرس لا يسجل ملفات صور أو ترويسات مرفقة بهذه الحزم. الحزم المختومة S48/S49 الموزعة خارج المثبت تحتاج لكل حزمة سجل مصادر ورخص وإذن توزيع مستقلًا؛ لا وعد بإعادة توزيع صور قاط المالك قبل ذلك.

## نقص محدد لم يُغط بعبارة «مفتوح المصدر»

**buffers@0.1.1:** ملف الحزمة المثبتة بلا حقل license ولا ملف LICENSE/NOTICE، والمولد يظهر «غير مذكورة في الحزمة — انظر مستودعها». رابط المصدر المذكور فيها substack/node-buffers أعاد 404 عند التحقق في ٣٠ ت١. ظهرت نسخة fork تذكر MIT/X11، لكن ذلك وحده لا يثبت رخصة القطعة المثبتة وبصمتها. لم نبدلها إلى MIT بالتخمين ولم ننزل اعتمادًا.

قبل توزيع البرنامج يلزم استكمال دليل رخصة النسخة المطابقة ونصها من مصدر موثوق، أو أمر بديل مراجع إن تعذر؛ موافقة المالك على مسودة النص لا تنشئ إذنًا من صاحب المكتبة. كذلك بعض الاعتمادات تحمل تسمية رخصة بلا ملف نص داخل حزمتها؛ ينبغي استكمال نصوصها عند تجهيز الحزمة. تعدد MIT/GPL في jszip اختيار رخصة بديلة، وليس إعلان أن برنامج ديوان كله GPL؛ الرخص الفعلية ونصوصها هي المرجع.

## سجل المصادر الأولية التي قُرئت

اطلاع ٣٠ ت١ ٢٠٢٦؛ لا تنزيل أوزان أو خطوط:

- [OFL الرسمي](https://openfontlicense.org/)، مع LICENSE المحلي لكل خط؛ الإشعارات والشروط عند تضمين الخط في برنامج.
- [بطاقة MODNet المحوّل](https://huggingface.co/Xenova/modnet/raw/main/README.md): Apache-2.0؛ [أصل المشروع](https://github.com/ZHKKe/MODNet) في NOTICE.
- [بطاقة أوزان BiRefNet_lite-matting](https://huggingface.co/ZhengPeng7/BiRefNet_lite-matting/raw/main/README.md): MIT.
- [رخصة YuNet في مجلد النموذج](https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/LICENSE): MIT.
- [رخصة MMPose](https://github.com/open-mmlab/mmpose/blob/main/LICENSE): Apache-2.0؛ رخص بيانات التدريب ليست مستبدلة بهذه القراءة.
- [رخصة tessdata](https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/LICENSE): Apache-2.0.
- رابط buffers الأصلي المتعذر [substack/node-buffers](https://github.com/substack/node-buffers)؛ دليل النقص في package.json وREADME المثبتين، لا اعتماد على قوائم رخص ثانوية.

## الدليل العملي

reports/d231-inventory.json يحتفظ ببصمات ملفات النماذج الأربعة وبمطابقة بصمات الحزم السبع للفهرس وبثبات ناتجي المولد في تشغيلين. ليس ملف reports جزءًا من المنتج أو الإيداع. فحص الموارد هنا قراءة ملفات، لا فحص حزمة متجر أو مثبت جديد؛ ذلك يبقى لمحطة الإصدار المأذونة.
