import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinanceService } from './services/finance.service';
import { DashboardComponent } from './components/dashboard/dashboard.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DashboardComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  finance   = inject(FinanceService);
  activePage = 'overview';

  setRole(e: Event)   { this.finance.userRole.set((e.target as HTMLSelectElement).value as any); }
  setPage(p: string)  { this.activePage = p; }

  exportCSV() {
    const rows = [['Date','Description','Category','Type','Amount'],
      ...this.finance.transactions().map(t => [t.date, `"${t.description}"`, t.category, t.type, t.amount])];
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map(r => r.join(',')).join('\n'));
    a.download = 'transactions.csv';
    a.click();
  }
}