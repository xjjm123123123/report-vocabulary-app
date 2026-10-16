# 发音数据来源

本应用将音标随静态页面保存，运行时无需调用音标接口。

- 美式 IPA 数据：open-dict-data/ipa-dict 的 en_US.txt，基于 cmudict-ipa，MIT 许可证。
  https://github.com/open-dict-data/ipa-dict/blob/master/data/en_US.txt
  https://github.com/lingz/cmudict-ipa
- 英式 IPA 数据：open-dict-data/ipa-dict 的 en_UK.txt，源自 ipacards，GPL-3.0 许可证。
  https://github.com/open-dict-data/ipa-dict/blob/master/data/en_UK.txt
  https://github.com/leoboiko/ipacards
- 本应用仅保留词库中1000词的相关条目；英式词形在适当情况下对应 analyse、organise 等拼写；补充缺失音标，并按词库词性选择 content、record、read 等词的读法。IPA 可能包含多个常见读音，用逗号分隔。
- 发音播放：有道词典发音接口，type=1 为英式、type=2 为美式。接口失败后尝试当前浏览器的英语语音。多读音词优先用带语境的浏览器语音，以匹配词库词性，按钮下方标注读法。
  https://dict.youdao.com/dictvoice
- IPA来源各自保留原许可证，全文见 licenses/。其他来源数据的许可不扩展到无关文件。
