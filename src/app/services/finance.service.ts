import { Injectable, signal, computed } from '@angular/core';
import { Transaction, UserRole } from '../models/finance.model';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  userRole = signal<UserRole>('Admin');
  searchQuery = signal('');
  filterType = signal('');
  filterCategory = signal('');
  selectedCategory = signal('');

  transactions = signal<Transaction[]>(this.load());

  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const ft = this.filterType();
    const fc = this.filterCategory() || this.selectedCategory();

    return this.transactions()
      .filter(t => {
        if (q && !t.description.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false;
        if (ft && t.type !== ft) return false;
        if (fc && t.category !== fc) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  totalIncome = computed(() =>
    this.filtered()
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)
  );

  totalExpense = computed(() =>
    this.filtered()
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
  );

  totalBalance = computed(() => this.totalIncome() - this.totalExpense());

  allCategories = computed(() =>
    [...new Set(this.transactions().map(t => t.category))].sort()
  );

  clearAllFilters() {
    this.searchQuery.set('');
    this.filterType.set('');
    this.filterCategory.set('');
    this.selectedCategory.set('');
  }

  clearCategoryFilter() {
    this.selectedCategory.set('');
  }

  toggleCategoryFromChart(category: string) {
    this.selectedCategory.update(curr => curr === category ? '' : category);
  }

  add(t: Omit<Transaction, 'id'>) {
    this.transactions.update(p => [{ ...t, id: 'tx' + Date.now() }, ...p]);
    this.save();
  }

  remove(id: string) {
    this.transactions.update(p => p.filter(t => t.id !== id));
    this.save();
  }

  update(t: Transaction) {
    this.transactions.update(p => p.map(x => x.id === t.id ? t : x));
    this.save();
  }

  private save() {
    localStorage.setItem('fin_data', JSON.stringify(this.transactions()));
  }

  private load(): Transaction[] {
    const s = localStorage.getItem('fin_data');
    if (s) return JSON.parse(s);

    return [
      { id:'1',  date:'2026-01-05', amount:5200, category:'Salary',        type:'income',  description:'Monthly salary Jan' },
      { id:'2',  date:'2026-01-10', amount:1400, category:'Rent',          type:'expense', description:'Home rent Jan' },
      { id:'3',  date:'2026-01-15', amount:180,  category:'Food',          type:'expense', description:'Grocery run' },
      { id:'4',  date:'2026-01-22', amount:850,  category:'Freelance',     type:'income',  description:'Design project' },
      { id:'5',  date:'2026-01-28', amount:95,   category:'Transport',     type:'expense', description:'Bus pass' },
      { id:'6',  date:'2026-02-05', amount:5200, category:'Salary',        type:'income',  description:'Monthly salary Feb' },
      { id:'7',  date:'2026-02-08', amount:1400, category:'Rent',          type:'expense', description:'Home rent Feb' },
      { id:'8',  date:'2026-02-14', amount:220,  category:'Shopping',      type:'expense', description:'Valentine gifts' },
      { id:'9',  date:'2026-02-20', amount:150,  category:'Food',          type:'expense', description:'Dining out' },
      { id:'10', date:'2026-02-25', amount:300,  category:'Health',        type:'expense', description:'Dentist' },
      { id:'11', date:'2026-03-05', amount:5200, category:'Salary',        type:'income',  description:'Monthly salary Mar' },
      { id:'12', date:'2026-03-08', amount:1400, category:'Rent',          type:'expense', description:'Home rent Mar' },
      { id:'13', date:'2026-03-12', amount:1200, category:'Freelance',     type:'income',  description:'Web project' },
      { id:'14', date:'2026-03-18', amount:75,   category:'Entertainment', type:'expense', description:'Streaming subs' },
      { id:'15', date:'2026-03-22', amount:340,  category:'Shopping',      type:'expense', description:'Clothing' },
      { id:'16', date:'2026-04-01', amount:5200, category:'Salary',        type:'income',  description:'Monthly salary Apr' },
      { id:'17', date:'2026-04-02', amount:1400, category:'Rent',          type:'expense', description:'Home rent Apr' },
      { id:'18', date:'2026-04-03', amount:200,  category:'Food',          type:'expense', description:'Weekly groceries' },
    ];
  }
}