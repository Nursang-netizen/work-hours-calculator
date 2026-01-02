// script.js
// Initialize with safe localStorage access
let workHistory = [];
let currentMode = 'forecast';

try {
    const stored = localStorage.getItem('hybridWorkLog');
    workHistory = stored ? JSON.parse(stored) : [];
} catch (e) {
    console.error('Failed to load history:', e);
    workHistory = [];
}

window.onload = function() {
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('dateFrom').value = todayStr;
    document.getElementById('dateTo').value = todayStr;
    
    if (workHistory.length > 0) {
        renderHistoryList();
        setMode('history');
    } else {
        updateUI();
    }
};

function setMode(mode) {
    currentMode = mode;
    updateUI();
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(registration => {
        console.log('ServiceWorker registered:', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}

function updateUI() {
    if (currentMode === 'forecast') {
        runForecastMath();
    } else {
        runHistoryMath();
    }
}

function runForecastMath() {
    const from = new Date(document.getElementById('dateFrom').value);
    const to = new Date(document.getElementById('dateTo').value);
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const breakMins = parseInt(document.getElementById('breakTime').value) || 0;
    
    if (breakMins < 0) {
        showToast("Break time cannot be negative", "warning");
        document.getElementById('breakTime').value = 0;
        return;
    }
    
    if (rate < 0) {
        showToast("Hourly rate cannot be negative", "warning");
        document.getElementById('hourlyRate').value = 0;
        return;
    }
    
    const h = calculateHours(breakMins);
    
    let days;
    if (from > to) {
        days = 1;
    } else {
        days = Math.ceil(Math.abs(to - from) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    const total = days * h * rate;

    document.getElementById('resultCard').classList.remove("history-mode");
    document.getElementById('displayLabel').innerText = "Estimated Earnings";
    document.getElementById('mainTotal').innerText = `$${total.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    if (from > to) {
        document.getElementById('subDetail').innerText = `1 Day (Start date only) x ${h.toFixed(2)}h`;
    } else {
        document.getElementById('subDetail').innerText = `${days} Days x ${h.toFixed(2)}h`;
    }
}

function runHistoryMath() {
    let totalMoney = 0;
    let totalHours = 0;
    workHistory.forEach(item => {
        totalMoney += item.salary;
        totalHours += item.hours;
    });

    document.getElementById('resultCard').classList.add("history-mode");
    document.getElementById('displayLabel').innerText = "Total Earned (History)";
    document.getElementById('mainTotal').innerText = `$${totalMoney.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('subDetail').innerText = `Total Worked: ${totalHours.toFixed(2)} Hours`;
    
    document.getElementById('historySection').style.display = workHistory.length > 0 ? "block" : "none";
}

function generateRangeHistory() {
    const from = new Date(document.getElementById('dateFrom').value);
    const to = new Date(document.getElementById('dateTo').value);
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const breakMins = parseInt(document.getElementById('breakTime').value) || 0;
    
    if (rate < 0 || breakMins < 0) {
        showToast("Please enter valid positive values", "warning");
        return;
    }
    
    workHistory = []; 
    
    if (from > to) {
        const h = calculateHours(breakMins);
        workHistory.push({
            id: Date.now() + Math.random(),
            date: from.toISOString().split('T')[0],
            hours: h,
            salary: h * rate,
            rate: rate
        });
    } else {
        let cur = new Date(from);
        while (cur <= to) {
            const h = calculateHours(breakMins);
            workHistory.push({
                id: Date.now() + Math.random(),
                date: cur.toISOString().split('T')[0],
                hours: h,
                salary: h * rate,
                rate: rate
            });
            cur.setDate(cur.getDate() + 1);
        }
    }
    currentMode = 'history';
    saveAndRefresh();
}

function calculateHours(breakMins) {
    const s = new Date(`2000-01-01T${document.getElementById('startTime').value}`);
    const e = new Date(`2000-01-01T${document.getElementById('endTime').value}`);
    let diff = (e - s) / 1000 / 60;
    if (diff < 0) diff += 1440;
    return Math.max(0, (diff - breakMins) / 60);
}

function renderHistoryList() {
    const list = document.getElementById('historyList');
    list.innerHTML = '';
    
    if (workHistory.length === 0) {
        document.getElementById('historySection').style.display = 'none';
        return;
    }
    
    workHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    workHistory.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="date-cell">
                <input type="date" class="editable-input" value="${item.date}" 
                       onchange="updateItem(${item.id}, 'date', this.value)"
                       data-index="${index}">
            </td>
            <td class="hours-cell">
                <input type="number" step="0.01" class="editable-input" value="${item.hours.toFixed(2)}" 
                       onchange="updateItem(${item.id}, 'hours', this.value)"
                       data-index="${index}">
            </td>
            <td class="pay-cell">
                <input type="number" step="0.01" class="editable-input" value="${item.salary.toFixed(2)}" 
                       onchange="updateItem(${item.id}, 'salary', this.value)"
                       data-index="${index}">
                <button class="delete-btn-hover" onclick="deleteItem(${item.id})">✕</button>
            </td>
        `;
        list.appendChild(row);
    });
    
    document.getElementById('historySection').style.display = 'block';
}

function updateItem(id, field, value) {
    const item = workHistory.find(i => i.id === id);
    if (!item) return;
    
    if (field === 'date') {
        item.date = value;
    } else if (field === 'hours') {
        const hours = parseFloat(value) || 0;
        if (hours < 0) {
            showToast("Hours cannot be negative", "warning");
            return;
        }
        item.hours = hours;
        item.salary = hours * (item.rate || parseFloat(document.getElementById('hourlyRate').value) || 0);
    } else if (field === 'salary') {
        const salary = parseFloat(value) || 0;
        if (salary < 0) {
            showToast("Salary cannot be negative", "warning");
            return;
        }
        item.salary = salary;
    }
    
    saveAndRefresh();
}

function copyShiftRecords() {
    if (workHistory.length === 0) {
        showToast("No records to copy", "warning");
        return;
    }
    
    const sortedHistory = [...workHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
    let csvContent = "Date,Hours,Pay\n";
    
    sortedHistory.forEach(item => {
        csvContent += `${item.date},${item.hours.toFixed(2)},$${item.salary.toFixed(2)}\n`;
    });
    
    const totalHours = sortedHistory.reduce((sum, item) => sum + item.hours, 0).toFixed(2);
    const totalPay = sortedHistory.reduce((sum, item) => sum + item.salary, 0).toFixed(2);
    csvContent += `\nTotal,${totalHours},$${totalPay}`;
    
    navigator.clipboard.writeText(csvContent).then(() => {
        showToast("Shift records copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast("Failed to copy to clipboard", "error");
    });
}

function showToast(message, type = "success") {
    const toast = document.getElementById('copyToast');
    toast.textContent = message;
    toast.className = 'toast';
    
    if (type === "success") {
        toast.style.background = "var(--success)";
    } else if (type === "warning") {
        toast.style.background = "var(--warning)";
        toast.classList.add('warning');
    } else if (type === "error") {
        toast.style.background = "var(--danger)";
        toast.classList.add('error');
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function clearAllRecords() {
    if (workHistory.length === 0) {
        showToast("No records to clear", "warning");
        return;
    }
    
    if (confirm("Delete ALL history?")) {
        workHistory = [];
        currentMode = 'forecast';
        saveAndRefresh();
        showToast("All records cleared");
    }
}

function saveAndRefresh() {
    try {
        localStorage.setItem('hybridWorkLog', JSON.stringify(workHistory));
        renderHistoryList();
        updateUI();
    } catch (e) {
        console.error('Failed to save:', e);
        showToast("Failed to save changes", "error");
    }
}

function deleteItem(id) {
    if (confirm("Delete this shift record?")) {
        workHistory = workHistory.filter(i => i.id !== id);
        if (workHistory.length === 0) currentMode = 'forecast';
        saveAndRefresh();
        showToast("Record deleted");
    }
}