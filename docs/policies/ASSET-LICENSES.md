# جرد موارد ديوان ورخصها قبل النشر

> D231 — ٣٠ ت١ ٢٠٢٦، وحدّثه D234 بجواب المالك (ر188). جرد الأدلة المتاحة؛ ليس إقرارًا بحقوق محتوى يقدمه المكتب أو ضمان امتثال قانوني. لا موارد جديدة أضيفت.

## ما يتحقق منه الجرد

package.json يحزم out والاعتمادات التشغيلية وملفات القاعدة، ويضع models وtessdata وpacks والإشعارات بجوار البرنامج. يولد tools/make-notices.mjs الإشعارات من ملف القفل والحزم المحلية وموارد النماذج: **١٦١ إدخالًا، منها ١٥٥ حزمة وإدخالات الموارد الستة** (بعد D234؛ كانت ١٦٨). الأسماء والإصدارات والنصوص في resources/THIRD-PARTY-NOTICES.txt؛ ملخص الواجهة في assets/notices.json. وما خلت حزمته من ملف رخصة فنصه من tools/notices/‹الاسم›@‹الإصدار›.txt بسطر مصدره؛ وحارس D234 في اختبار notices يرفض حزمة بلا رخصة معلنة أو بلا نص، ويطلب إشعارات onnxruntime.

| الصنف المشحون | الدليل والرخصة المعلنة | ما يلزم عند التوزيع |
|---|---|---|
| حزم npm وElectron | package-lock.json وحزم node_modules، وإشعارات ١٥٥ حزمة؛ ونصوص الست التي خلت من ملف رخصة في tools/notices | إبقاء نصوص الرخص وحقوق أصحابها؛ LICENSES.chromium.html وLICENSE من Electron في الحزمة النهائية؛ فحص المثبت الفعلي عند الإصدار |
| محرك onnxruntime الأصلي (onnxruntime-node 1.30.0: onnxruntime.dll وملحقه) | LICENSE لمايكروسوفت (MIT) وThirdPartyNotices.txt لإصداره كما هو في tools/notices، ملحق بالنصوص الكاملة؛ DirectML وdxcompiler وdxil مستثناة من المثبت في package.json | جلب إشعارات الإصدار الجديد مع كل تحديث لـonnxruntime؛ المولد يتوقف بغيابها |
| عشرة خطوط Fontsource | Amiri، Aref Ruqaa، Cairo، El Messiri، IBM Plex Sans، IBM Plex Sans Arabic، Lalezar، Noto Kufi Arabic، Noto Naskh Arabic، Reem Kufi؛ لكل حزمة LICENSE وOFL-1.1 | حمل الإشعارات؛ لا بيع الخط وحده؛ احترام الأسماء المحجوزة عند تعديل الخط، دون فرض رخصة الخط على الورقة التي طُبعت به |
| MODNet، ملف modnet-portrait-q8.onnx | resources/models/NOTICE.md وبصمته؛ Apache-2.0 في بطاقة Xenova/modnet | حفظ الرخصة ونسبة الأصل وبيان التحويل؛ المصدر أدناه |
| BiRefNet_lite-matting، ملف birefnet-lite-matting-q8.onnx | NOTICE وبطاقة صاحب الأوزان؛ MIT | حفظ نص MIT ونسبة الحقوق؛ التحويل المحلي موثق في NOTICE |
| YuNet، ملف face_detection_yunet_2023mar.onnx | رخصة مجلد النموذج الأصلي MIT وحقوق Shiqi Yu | إبقاء النص ونسبة صاحب الحقوق |
| RTMPose-t، ملف rtmpose-t-body7-256x192.onnx | NOTICE ومصدر OpenMMLab، Apache-2.0 | إبقاء الرخصة؛ التنبيه الموجود عن مجموعات التدريب يظل قائمًا، ولا يتحول هذا الجرد إلى شهادة بحقوق تلك المجموعات |
| بيانات OCR العربية والإنكليزية | ara.traineddata.gz وeng.traineddata.gz، Apache-2.0 في tessdata | حفظ الرخصة والإشعارات؛ بيانات اللغة محلية |
| كتالوج صور القاط المدمج | BUILTIN_SUITS=[]؛ مجلد assets/suits لا يحوي صورة، فيه .gitkeep فقط | لا تنسب صورًا إلى مكتبة مفتوحة بلا دليل. صحح D231 هذا الوصف في المولد والنصين مع حارس؛ الاستيراد والحزم لهما حقوق مستقلة |
| سبع حزم معاملات مدمجة | resources/packs/index.json والملفات السبعة؛ طابقت بصمة كل ملف فهرسه؛ وهي من صنع المالك وحقها له (ر188) | الفهرس يثبت سلامة النسخة، لا موافقة الجهات؛ مراجعة المالك للمحتوى R06 باقية لأنها صحة لا حقوق |
| صور/خطوط/شعارات/حزم يستوردها المكتب | ليست ترخيصًا يمنحه شراء ديوان | على من يوردها أن يثبت إذن استعمالها وتعديلها وتوزيعها؛ إتاحة الاستيراد أو التوقيع أو التشفير لا تمنح حقوق غيره |

حزم المثبت: civil-status (٤ نماذج/٤ كليشات)، court-petitions (٣/٣)، education (٦/٤)، general-requests (٣/٣)، higher-education (٥/٤)، housing-mukhtar (٣/٣)، school-letters (٤٥/٠). الفهرس لا يسجل ملفات صور أو ترويسات مرفقة بهذه الحزم. الحزم المختومة S48/S49 الموزعة خارج المثبت (القاط والمعاملات والكليشات والترويسات) **من صنع المالك وحقها له وحده** بقوله (ر188، ٣٠ ت١)، فلا يطلب لها دليل آخر؛ وما يدخل حزمة من صورة أو جزء من مصدر آخر يذكر مصدره ورخصته في سجل تلك الحزمة.

## ما كان ناقصًا وكيف أُغلق — D234

**buffers@0.1.1 خرجت من البرنامج.** كانت بلا حقل license ولا ملف LICENSE/NOTICE، ورابط مصدرها substack/node-buffers أعاد 404 في ٣٠ ت١؛ ولم تُبدل إلى MIT بالتخمين. كانت تأتي من exceljs ← unzipper 0.10.14 ← binary، ولا تعمل أصلًا: unzipper لا يستورده إلا قارئ exceljs التدفقي، وديوان يقرأ الإكسل بـxlsx.readFile عبر JSZip. بموافقة المالك (ر188 §٢) صار unzipper 0.12.5 بـoverrides داخل exceljs، وهو بلا binary ولا buffers ولا chainsaw، فخرجت معها traverse وfstream وغيرها، ولم تتغير نسخة حزمة قائمة؛ واختبارات الإكسل خضر. الحارس يرفض عودتها.

**النصوص الناقصة اكتملت.** ست حزم أعلنت رخصتها بلا ملف نص: hash.js وisarray (النص في README المثبت)، وsaxes (LICENSE عند v5.0.1)، وonnxruntime-common وonnxruntime-node (LICENSE عند v1.30.0)، وtr46 0.0.3 (لا ملف عند وسمه؛ MIT وصاحب الحق من package.json، والنص LICENSE.md لصاحبه نفسه من v1.0.0، والسطر الأول يقول ذلك). تعدد MIT/GPL في jszip اختيار رخصة بديلة، وليس إعلان أن برنامج ديوان كله GPL؛ الرخص الفعلية ونصوصها هي المرجع.

## سجل المصادر الأولية التي قُرئت

اطلاع ٣٠ ت١ ٢٠٢٦؛ لا تنزيل أوزان أو خطوط:

- [OFL الرسمي](https://openfontlicense.org/)، مع LICENSE المحلي لكل خط؛ الإشعارات والشروط عند تضمين الخط في برنامج.
- [بطاقة MODNet المحوّل](https://huggingface.co/Xenova/modnet/raw/main/README.md): Apache-2.0؛ [أصل المشروع](https://github.com/ZHKKe/MODNet) في NOTICE.
- [بطاقة أوزان BiRefNet_lite-matting](https://huggingface.co/ZhengPeng7/BiRefNet_lite-matting/raw/main/README.md): MIT.
- [رخصة YuNet في مجلد النموذج](https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/LICENSE): MIT.
- [رخصة MMPose](https://github.com/open-mmlab/mmpose/blob/main/LICENSE): Apache-2.0؛ رخص بيانات التدريب ليست مستبدلة بهذه القراءة.
- [رخصة tessdata](https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/LICENSE): Apache-2.0.
- رابط buffers الأصلي المتعذر [substack/node-buffers](https://github.com/substack/node-buffers)؛ دليل النقص كان في package.json وREADME المثبتين، وخرجت بـD234.
- D234: [unzipper في npm](https://www.npmjs.com/package/unzipper) (0.12.5 واعتمادياتها)، و[LICENSE saxes عند v5.0.1](https://github.com/lddubeau/saxes/blob/v5.0.1/LICENSE)، و[tr46 عند 0.0.3](https://github.com/jsdom/tr46/tree/0.0.3) و[LICENSE.md عند v1.0.0](https://github.com/jsdom/tr46/blob/v1.0.0/LICENSE.md)، و[LICENSE onnxruntime](https://github.com/microsoft/onnxruntime/blob/v1.30.0/LICENSE) و[ThirdPartyNotices.txt](https://github.com/microsoft/onnxruntime/blob/v1.30.0/ThirdPartyNotices.txt) عند v1.30.0.

## الدليل العملي

reports/d231-inventory.json يحتفظ ببصمات ملفات النماذج الأربعة وبمطابقة بصمات الحزم السبع للفهرس وبثبات ناتجي المولد في تشغيلين. ليس ملف reports جزءًا من المنتج أو الإيداع. فحص الموارد هنا قراءة ملفات، لا فحص حزمة متجر أو مثبت جديد؛ ذلك يبقى لمحطة الإصدار المأذونة.
