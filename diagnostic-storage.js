// 诊断脚本：直接检查 chrome.storage.local 中的用户脚本数据
// 在 Side Panel 控制台中运行此脚本

(async function() {
  console.warn('=== UserScripts Storage Diagnostic ===');
  
  // 1. 检查所有 storage keys
  const allData = await chrome.storage.local.get(null);
  const keys = Object.keys(allData);
  console.warn('All storage keys:', keys);
  
  // 2. 检查 userScripts key
  const result = await chrome.storage.local.get('userScripts');
  console.warn('userScripts raw result:', JSON.stringify(result));
  
  if (result.userScripts) {
    console.warn('userScripts type:', typeof result.userScripts);
    console.warn('userScripts is Array:', Array.isArray(result.userScripts));
    console.warn('userScripts length:', result.userScripts.length);
    if (result.userScripts.length > 0) {
      console.warn('First script:', JSON.stringify(result.userScripts[0]).substring(0, 200));
    }
  } else {
    console.warn('userScripts key NOT FOUND in storage!');
  }
  
  // 3. 测试写入和读回
  const testKey = 'userScripts_diagnostic_test';
  const testData = [{ id: 'test_1', name: 'Diagnostic Test', savedAt: Date.now() }];
  await chrome.storage.local.set({ [testKey]: testData });
  const readBack = await chrome.storage.local.get(testKey);
  console.warn('Write-read test:', JSON.stringify(readBack[testKey]));
  
  // 4. 清理测试数据
  await chrome.storage.local.remove(testKey);
  
  console.warn('=== Diagnostic Complete ===');
})();
