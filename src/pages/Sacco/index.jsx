import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Filter, Upload, Edit2, Trash2, Building2, Users, Coins, TrendingUp, Wallet, PiggyBank, DollarSign, Download } from 'lucide-react'
import { useSaccoStore } from '../../store/useSaccoStore'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatUGX } from '../../utils/formatters'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import MemberDetailsModal from './MemberDetailsModal'
import Finance from '../Finance'

export default function Sacco() {
  const { 
    members, 
    shares, 
    investors, 
    transactions, 
    savings,
    loading, 
    loadSaccoData, 
    addMember, 
    updateMember, 
    deleteMember, 
    updateShares, 
    updateSavings,
    convertSavingsToShares,
    updateInvestor, 
    addTransaction, 
    deleteTransaction,
    importFromExcel,
    getFinancials,
    selectedYear,
    setSelectedYear
  } = useSaccoStore()

  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'members'
  const setActiveTab = (tab) => setSearchParams({ tab })
  
  // Modals state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [isSharesModalOpen, setIsSharesModalOpen] = useState(false)
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false)
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)
  const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [detailedMemberId, setDetailedMemberId] = useState(null)

  const [editingMember, setEditingMember] = useState(null)
  const [editingSharesMember, setEditingSharesMember] = useState(null)
  const [editingSavingsMember, setEditingSavingsMember] = useState(null)
  const [editingConvertMember, setEditingConvertMember] = useState(null)
  const [editingInvestor, setEditingInvestor] = useState(null)
  
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isTxDeleteOpen, setIsTxDeleteOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Form states
  const initialMemberForm = { 
    name: '', phone: '', nin: '', category: ['Saving Member'], photo: '',
    correctBalance: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, total: 0, shares: 0,
    admin: 0, savings: 0, mandatory: 0, withdrawable: 0, requested: 0, difference: 0, noOfShares: 0
  }
  const [memberForm, setMemberForm] = useState(initialMemberForm)
  const [shareCountInput, setShareCountInput] = useState('1')
  
  // Savings states
  const [savingsInput, setSavingsInput] = useState('0')
  const [savingsMode, setSavingsMode] = useState('deposit') // deposit, withdraw
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [isBanked, setIsBanked] = useState(false)
  
  // Convert states
  const [convertSharesInput, setConvertSharesInput] = useState('1')
  
  // Investor Form states
  const initialInvestorForm = { 
    category: 'Money Maker', 
    investorType: 'Money Maker',
    investmentPhase: 'Initial',
    marketingStrategy: false,
    investmentAmount: '8000000', 
    cowsPerYear: '0' 
  }
  const [investorForm, setInvestorForm] = useState(initialInvestorForm)
  
  const initialTxForm = { date: format(new Date(), 'yyyy-MM-dd'), type: 'Income', category: 'Share Purchase', amount: '', description: '', paymentMethod: 'Cash', isBanked: false }
  const [txForm, setTxForm] = useState(initialTxForm)

  const excelInputRef = useRef(null)
  const investorExcelInputRef = useRef(null)

  const [isUnlocked, setIsUnlocked] = useState(() => sessionStorage.getItem('saccoUnlocked') === 'true')
  const [pinInput, setPinInput] = useState('')

  useEffect(() => {
    loadSaccoData()
  }, [])

  // ─── Financial Calculations ────────────────────────────────────────────────
  const financials = getFinancials()

  // ─── Photo Upload handler ──────────────────────────────────────────────────
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setMemberForm(prev => ({ ...prev, photo: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  // ─── Excel Import handler ──────────────────────────────────────────────────
  const handleInvestmentExcelImport = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
        await useSaccoStore.getState().importInvestmentExcel(data)
        alert('Investment Excel imported successfully!')
      } catch (err) {
        console.error(err)
        alert('Failed to parse Investment Excel file')
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleExcelImport = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })

        let totalImported = 0

        // Define financial year mapping based on sheet names
        const YEAR_MAP = {
          'GENERAL MEMBERSHIP': '2026',       // Jan-Dec 2026
          'JUNE MEMBERSHIP': '2026-2027',     // June 2026 - June 2027
          'PIONEER': '2026',                  // Pioneer sheet uses 2026
          'PHASE 3': '2026',                  // Phase 3 investors
        }

        const MEMBER_SHEETS = ['GENERAL MEMBERSHIP', 'JUNE MEMBERSHIP', 'PIONEER']

        for (const sheetName of wb.SheetNames) {
          if (!MEMBER_SHEETS.includes(sheetName)) continue

          const ws = wb.Sheets[sheetName]
          const data = XLSX.utils.sheet_to_json(ws)

          if (data.length > 0) {
            const financialYear = YEAR_MAP[sheetName] || '2026'
            await importFromExcel(data, financialYear, sheetName)
            totalImported += data.length
            console.log(`✅ Imported ${data.length} records from sheet "${sheetName}" for financial year ${financialYear}`)
          }
        }

        if (totalImported > 0) {
          alert(`Successfully imported ${totalImported} SACCO records across all sheets!\n\n• 2026 (Jan-Dec) = General Membership\n• 2026-2027 (Jun-Jun) = June Membership`)
        } else {
          // Fall back to single-sheet mode for custom files
          const wsname = wb.SheetNames[0]
          const ws = wb.Sheets[wsname]
          const data = XLSX.utils.sheet_to_json(ws)
          if (data.length > 0) {
            await importFromExcel(data, selectedYear, wsname)
            alert(`Successfully imported ${data.length} SACCO records for financial year ${selectedYear}!`)
          } else {
            alert('Excel file is empty.')
          }
        }
      } catch (err) {
        console.error('Import failed:', err)
        alert('Failed to parse excel file. Please check the file format.')
      }
      e.target.value = null // reset
    }
    reader.readAsBinaryString(file)
  }

  // ─── Excel Export handler ───────────────────────────────────────────────
  const handleExcelExport = () => {
    const rows = useSaccoStore.getState().exportToExcel()
    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'SACCO Members')
    XLSX.writeFile(wb, `SACCO_Members_Export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  // ─── Save Handlers ─────────────────────────────────────────────────────────────────────
  const handleSaveMember = async (e) => {
    e.preventDefault()
    if (editingMember) {
      await updateMember(editingMember.id, memberForm, selectedYear)
    } else {
      await addMember(memberForm, selectedYear)
    }
    setIsMemberModalOpen(false)
    setEditingMember(null)
    setMemberForm(initialMemberForm)
  }

  const handleSaveShares = async (e) => {
    e.preventDefault()
    if (editingSharesMember) {
      const newCount = Number(shareCountInput) || 1
      const oldCount = editingSharesMember.shareCount || 1
      await updateShares(editingSharesMember.id, newCount)
      if (newCount > oldCount) {
        await addTransaction({
          date: format(new Date(), 'yyyy-MM-dd'),
          type: 'Income',
          source: isBanked ? 'Bank' : paymentMethod,
          category: 'Share Purchase',
          amount: (newCount - oldCount) * 100000,
          paymentMethod,
          isBanked,
          description: `Share purchase for ${editingSharesMember.name} (${oldCount} → ${newCount} shares)`
        })
      }
    }
    setIsSharesModalOpen(false)
    setEditingSharesMember(null)
  }

  const handleSaveSavings = async (e) => {
    e.preventDefault()
    if (editingSavingsMember) {
      const current = savings.find(s => s.memberId === editingSavingsMember.id)?.savingAmount || 0
      const delta = Number(savingsInput) || 0
      const finalAmount = savingsMode === 'deposit' ? current + delta : Math.max(0, current - delta)
      
      await updateSavings(editingSavingsMember.id, finalAmount)
      
      // Log transaction
      await addTransaction({
        date: format(new Date(), 'yyyy-MM-dd'),
        type: savingsMode === 'deposit' ? 'Income' : 'Expense',
        source: isBanked ? 'Bank' : paymentMethod,
        category: 'Savings',
        amount: delta,
        paymentMethod,
        isBanked,
        description: `${savingsMode === 'deposit' ? 'Deposited' : 'Withdrew'} savings for ${editingSavingsMember.name}`
      })
    }
    setIsSavingsModalOpen(false)
    setEditingSavingsMember(null)
  }

  const handleSaveConvert = async (e) => {
    e.preventDefault()
    if (editingConvertMember) {
      const res = await convertSavingsToShares(editingConvertMember.id, convertSharesInput)
      if (res.success) {
        alert('Conversion successful!')
      } else {
        alert(res.error || 'Conversion failed.')
      }
    }
    setIsConvertModalOpen(false)
    setEditingConvertMember(null)
  }

  const handleSaveInvestor = async (e) => {
    e.preventDefault()
    if (editingInvestor) {
      await updateInvestor(editingInvestor.id, {
        category: investorForm.investorType || investorForm.category,
        investorType: investorForm.investorType || investorForm.category,
        investmentPhase: investorForm.investmentPhase || 'Initial',
        marketingStrategy: investorForm.marketingStrategy || false,
        investmentAmount: Number(investorForm.investmentAmount) || 8000000,
        cowsPerYear: Number(investorForm.cowsPerYear) || 0
      })
    }
    setIsInvestorModalOpen(false)
    setEditingInvestor(null)
  }

  const handleSaveTx = async (e) => {
    e.preventDefault()
    await addTransaction(txForm)
    setIsTxModalOpen(false)
    setTxForm(initialTxForm)
  }

  // ─── Tables Data Preparation ───────────────────────────────────────────────
  const hasSavingCategory = (catVal) => {
    const cats = Array.isArray(catVal) ? catVal : [catVal || 'Saving Member']
    return cats.includes('Saving Member') || cats.includes('Pioneer')
  }

  const matchesFilter = (m) => {
    const matchesSearch = m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.phone?.includes(searchQuery) || 
                          m.nin?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter 
      ? (Array.isArray(m.category) ? m.category.includes(categoryFilter) : m.category === categoryFilter) 
      : true
    return matchesSearch && matchesCategory
  }

  const filteredMembers = members
    .filter(m => hasSavingCategory(m.category))
    .filter(matchesFilter)
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map((m, i) => ({ ...m, index: i + 1 }))

  const sharesData = members
    .filter(m => hasSavingCategory(m.category))
    .filter(matchesFilter)
    .map(m => {
      const shareObj = shares.find(s => s.memberId === m.id)
      const count = shareObj?.shareCount || 1 // Minimum 1 share enforced
      return {
        id: m.id,
        name: m.name,
        category: m.category,
        shareCount: count,
        value: count * 100000
      }
    })

  const savingsData = members
    .filter(m => hasSavingCategory(m.category))
    .filter(matchesFilter)
    .map(m => {
      const savingObj = savings.find(s => s.memberId === m.id)
      const count = savingObj?.savingAmount || 0
      return {
        id: m.id,
        name: m.name,
        category: m.category,
        savingAmount: count
      }
    })

  const investorsData = investors.map(i => {
    const member = members.find(m => m.id === i.memberId)
    return {
      ...i,
      name: member?.name || i.name || 'Unknown',
      memberCategory: member?.category || i.category || 'Investor'
    }
  }).filter(i => {
    const matchesSearch = i.name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCat = categoryFilter ? (i.category === categoryFilter || i.memberCategory === categoryFilter || (Array.isArray(i.memberCategory) && i.memberCategory.includes(categoryFilter))) : true
    return matchesSearch && matchesCat
  })
  
  const phase3Count = investorsData.filter(i => i.investmentPhase === 'Phase 3').length

  const txData = [...transactions].sort((a,b) => new Date(b.date) - new Date(a.date))

  // ─── Table Columns ─────────────────────────────────────────────────────────
  const memberColumns = [
    { key: 'index', label: '#', render: (val) => <span className="text-slate-500 font-medium text-xs">{val}</span> },
    { key: 'photo', label: 'Photo', sortable: false, render: (val, row) => (
      <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
        {val ? (
          <img src={val} alt={row.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-semibold text-slate-400">{row.name?.[0]?.toUpperCase()}</span>
        )}
      </div>
    )},
    { key: 'name', label: 'Name', render: (val, row) => (
      <button onClick={() => { setDetailedMemberId(row.id); setIsDetailsModalOpen(true); }} className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors text-left underline decoration-emerald-500/30 underline-offset-4">
        {val}
      </button>
    )},
    { key: 'total', label: 'Total Paid', render: (val) => <span className="text-emerald-400 font-bold">{formatUGX(val)}</span> },
    { key: 'shares', label: 'Shares Amt', render: (val) => formatUGX(val) },
    { key: 'admin', label: 'Admin Fee', render: (val) => formatUGX(val) },
    { key: 'noOfShares', label: 'No. Shares', render: (val) => <span className="font-semibold text-white">{val}</span> },
    { key: 'category', label: 'Category', render: (val) => {
      const colors = {
        'Pioneer': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        'Investor': 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
        'Saving Member': 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      }
      const cats = Array.isArray(val) ? val : [val || 'Saving Member']
      return (
        <div className="flex gap-1 flex-wrap">
          {cats.map(c => (
            <span key={c} className={`px-2 py-1 rounded-full text-[10px] font-medium ${colors[c] || 'bg-slate-500/10 text-slate-400'}`}>{c}</span>
          ))}
        </div>
      )
    }},
    { key: 'actions', label: 'Actions', sortable: false, render: (_, row) => (
      <div className="flex items-center gap-2">
        <button onClick={() => {
          setEditingMember(row)
          setMemberForm({
            name: row.name || '', phone: row.phone || '', nin: row.nin || '', 
            category: Array.isArray(row.category) ? row.category : [row.category || 'Saving Member'], 
            photo: row.photo || '',
            correctBalance: row.correctBalance || 0, jan: row.jan || 0, feb: row.feb || 0, mar: row.mar || 0, apr: row.apr || 0, may: row.may || 0, jun: row.jun || 0,
            jul: row.jul || 0, aug: row.aug || 0, sep: row.sep || 0, oct: row.oct || 0, nov: row.nov || 0, dec: row.dec || 0, total: row.total || 0,
            shares: row.shares || 0, admin: row.admin || 0, savings: row.savings || 0, mandatory: row.mandatory || 0, withdrawable: row.withdrawable || 0,
            requested: row.requested || 0, difference: row.difference || 0, noOfShares: row.noOfShares || 0
          })
          setIsMemberModalOpen(true)
        }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="Edit">
          <Edit2 size={14} />
        </button>
        <button onClick={() => { setSelectedItem(row); setIsDeleteOpen(true) }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400" title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    )}
  ]

  const sharesColumns = [
    { key: 'name', label: 'Member Name', render: (val, row) => (
      <button onClick={() => { setDetailedMemberId(row.id); setIsDetailsModalOpen(true); }} className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors text-left underline decoration-emerald-500/30 underline-offset-4">
        {val}
      </button>
    )},
    { key: 'category', label: 'Category' },
    { key: 'shareCount', label: 'Shares Owned', render: (val) => <span className="font-bold text-white">{val}</span> },
    { key: 'value', label: 'Total Value', render: (val) => <span className="text-emerald-400 font-semibold">{formatUGX(val)}</span> },
    { key: 'actions', label: 'Manage', sortable: false, render: (_, row) => (
      <button onClick={() => {
        setEditingSharesMember(row)
        setShareCountInput(String(row.shareCount))
        setIsSharesModalOpen(true)
      }} className="btn-secondary px-2.5 py-1 text-xs text-white flex items-center gap-1">
        <Coins size={12} /> Adjust Shares
      </button>
    )}
  ]

  const savingsColumns = [
    { key: 'name', label: 'Member Name', render: (val, row) => (
      <button onClick={() => { setDetailedMemberId(row.id); setIsDetailsModalOpen(true); }} className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors text-left underline decoration-emerald-500/30 underline-offset-4">
        {val}
      </button>
    )},
    { key: 'category', label: 'Category' },
    { key: 'savingAmount', label: 'Savings Balance', render: (val) => <span className="text-blue-400 font-bold">{formatUGX(val)}</span> },
    { key: 'actions', label: 'Actions', sortable: false, render: (_, row) => (
      <div className="flex gap-2">
        <button onClick={() => {
          setEditingSavingsMember(row)
          setSavingsInput('')
          setSavingsMode('deposit')
          setIsSavingsModalOpen(true)
        }} className="btn-secondary px-2 py-1 text-xs text-white flex items-center gap-1 hover:bg-emerald-500/10">
          <PiggyBank size={12} /> Add/Withdraw
        </button>
        <button onClick={() => {
          setEditingConvertMember(row)
          setConvertSharesInput('1')
          setIsConvertModalOpen(true)
        }} className="btn-secondary px-2 py-1 text-xs text-white flex items-center gap-1 hover:bg-purple-500/10" disabled={row.savingAmount < 100000}>
          <Coins size={12} /> Convert to Shares
        </button>
      </div>
    )}
  ]

  const investorsColumns = [
    { key: 'name', label: 'Investor Name', render: (val, row) => {
      const isMarketing = row.marketingStrategy
      const paid = row.investmentAmount || 0
      const program = row.programAmount || row.investmentAmount || 8000000
      const cleared = row.status === 'CLEARED' || (paid >= program && program > 0) || paid >= 8000000
      const markColor = isMarketing 
        ? 'bg-yellow-500' 
        : cleared 
          ? 'bg-emerald-500' 
          : 'bg-red-500'
      return (
        <button onClick={() => { setDetailedMemberId(row.memberId || row.id); setIsDetailsModalOpen(true); }}
                className="flex items-center gap-2 font-semibold transition-colors text-left hover:text-slate-300">
          <span className={`w-3 h-3 border border-black/20 ${markColor} shrink-0`}></span>
          <span className="text-slate-200 underline underline-offset-4 decoration-slate-600">{val}</span>
        </button>
      )
    }},
    { key: 'investorType', label: 'Type', render: (val, row) => {
      const type = val || row.category || 'Money Maker'
      return (
        <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${type === 'Money Maker' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
          {type}
        </span>
      )
    }},
    { key: 'investmentPhase', label: 'Phase', render: (val) => <span className="text-slate-300 text-xs">{val || 'Phase 3'}</span> },
    { key: 'programAmount', label: 'Program', render: (val, row) => {
      const program = val || row.investmentAmount || 0
      return <span className="text-slate-300 font-medium">{formatUGX(program)}</span>
    }},
    { key: 'investmentAmount', label: 'Paid', render: (val, row) => {
      const program = row.programAmount || val || 0
      const paid = val || 0
      const cleared = row.status === 'CLEARED' || paid >= program
      return (
        <div>
          <p className={`font-bold ${cleared ? 'text-emerald-400' : 'text-orange-400'}`}>{formatUGX(paid)}</p>
          {program > 0 && <div className="w-full bg-white/10 rounded-full h-1 mt-1"><div className={`h-1 rounded-full ${cleared ? 'bg-emerald-500' : 'bg-orange-400'}`} style={{width: `${Math.min(100, (paid/program)*100).toFixed(0)}%`}}></div></div>}
        </div>
      )
    }},
    { key: 'balance', label: 'Balance', render: (val, row) => {
      const balance = val || (row.programAmount ? row.programAmount - (row.investmentAmount || 0) : 0)
      return balance > 0 
        ? <span className="text-red-400 font-semibold">{formatUGX(balance)}</span>
        : <span className="text-emerald-400 font-semibold">Cleared ✓</span>
    }},
    { key: 'status', label: 'Status', render: (val, row) => {
      const paid = row.investmentAmount || 0
      const program = row.programAmount || paid
      const cleared = val === 'CLEARED' || paid >= program
      const isMarketing = row.marketingStrategy
      if (isMarketing) return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Marketing</span>
      return cleared
        ? <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ CLEARED</span>
        : <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">✗ PENDING</span>
    }},
    { key: 'actions', label: 'Configure', sortable: false, render: (_, row) => (
      <button onClick={() => {
        setEditingInvestor(row)
        setInvestorForm({
          category: row.category || 'Money Maker',
          investorType: row.investorType || row.category || 'Money Maker',
          investmentPhase: row.investmentPhase || 'Phase 3',
          marketingStrategy: row.marketingStrategy || false,
          investmentAmount: String(row.investmentAmount || '0'),
          cowsPerYear: String(row.cowsPerYear || '0')
        })
        setIsInvestorModalOpen(true)
      }} className="btn-secondary px-2.5 py-1 text-xs text-white flex items-center gap-1">
        <Edit2 size={12} /> Configure
      </button>
    )}
  ]

  const PM_COLOR = {
    'Cash':     'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    'MTN MM':   'bg-yellow-500/15 text-yellow-300 border border-yellow-500/20',
    'Airtel MM':'bg-red-500/15 text-red-400 border border-red-500/20',
    'Bank':     'bg-blue-500/15 text-blue-400 border border-blue-500/20',
    'Cheque':   'bg-violet-500/15 text-violet-400 border border-violet-500/20',
    'Other':    'bg-slate-500/15 text-slate-400 border border-slate-500/20',
  }

  const txColumns = [
    { key: 'date', label: 'Date', render: (val) => {
      try { return format(new Date(val), 'dd MMM yyyy') } catch { return val }
    }},
    { key: 'type', label: 'Type', render: (val) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${val === 'Income' ? 'bg-green-500/10 text-green-400' : val === 'Expense' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
        {val}
      </span>
    )},
    { key: 'category', label: 'Category', render: (val) => <span className="text-slate-300 text-xs">{val}</span> },
    { key: 'paymentMethod', label: 'Via', render: (val) => {
      const pm = val || 'Cash'
      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PM_COLOR[pm] || PM_COLOR['Other']}`}>{pm}</span>
    }},
    { key: 'isBanked', label: 'Banked', render: (val) => val
      ? <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">✓ Banked</span>
      : <span className="text-orange-400 text-xs font-semibold flex items-center gap-1">⚠ Not Banked</span>
    },
    { key: 'amount', label: 'Amount', render: (val, row) => (
      <span className={`font-semibold ${row.type === 'Income' ? 'text-green-400' : row.type === 'Expense' ? 'text-red-400' : 'text-blue-400'}`}>
        {row.type === 'Expense' ? '-' : ''}{formatUGX(val)}
      </span>
    )},
    { key: 'description', label: 'Description', render: (val) => <span className="text-xs text-slate-400 truncate max-w-[150px] block">{val || '—'}</span> },
    { key: 'actions', label: '', sortable: false, render: (_, row) => (
      <button onClick={() => { setSelectedItem(row); setIsTxDeleteOpen(true) }} className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400">
        <Trash2 size={14} />
      </button>
    )}
  ]

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-2">
          <Building2 className="text-emerald-400" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white">SACCO Access Secured</h2>
        <p className="text-slate-400 text-sm mb-4 text-center max-w-sm">Please enter the security PIN to access the SACCO management portal.</p>
        
        <form 
          onSubmit={(e) => {
            e.preventDefault()
            if (pinInput === '7654320') {
              setIsUnlocked(true)
              sessionStorage.setItem('saccoUnlocked', 'true')
            } else {
              alert('Incorrect PIN')
              setPinInput('')
            }
          }} 
          className="flex gap-2 w-full max-w-xs"
        >
          <input 
            type="password" 
            placeholder="Enter PIN" 
            className="input-field text-center font-mono tracking-[0.3em] text-lg flex-1"
            value={pinInput}
            onChange={e => setPinInput(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-primary px-6">Unlock</button>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Building2 className="text-emerald-400" size={24} />
          </div>
          <div>
            <h1 className="page-title text-2xl font-bold text-white">SACCO Management</h1>
            <p className="text-slate-400 text-sm">Members list, share counting, savings, investor calculations, and accounts ledgers.</p>
          </div>
        </div>

        {/* Seed Data loading removed */}        {activeTab === 'investors' && (
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <input 
              type="file" 
              ref={investorExcelInputRef} 
              onChange={handleInvestmentExcelImport} 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
            />
            <button 
              onClick={() => investorExcelInputRef.current.click()} 
              className="btn-secondary text-indigo-400 border border-indigo-500/30 flex items-center gap-2"
            >
              <Upload size={16} /> Import Investment Excel
            </button>
            <button 
              onClick={async () => {
                if (window.confirm('WARNING: This will delete all investors imported from the general excel (Phase 3). Are you sure?')) {
                  await useSaccoStore.getState().clearPhase3Investors()
                  alert('General investors cleared.')
                }
              }} 
              className="btn-secondary text-red-400 border border-red-500/30 flex items-center gap-2"
            >
              <Trash2 size={16} /> Clear General Investors
            </button>
          </div>
        )}

        {/* Dynamic header button based on active tab */}
        {activeTab === 'members' && (
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <input 
              type="file" 
              ref={excelInputRef} 
              onChange={handleExcelImport} 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
            />
            <button 
              onClick={() => excelInputRef.current.click()} 
              className="btn-secondary text-white flex items-center gap-2"
            >
              <Upload size={16} /> Import Excel
            </button>
            <button 
              onClick={handleExcelExport} 
              className="btn-secondary text-emerald-400 border border-emerald-500/30 flex items-center gap-2"
            >
              <Download size={16} /> Export Excel
            </button>
            <button 
              onClick={() => { setEditingMember(null); setMemberForm(initialMemberForm); setIsMemberModalOpen(true) }} 
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> Add Member
            </button>
          </div>
        )}
        {activeTab === 'accounts' && (
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <button 
              onClick={async () => {
                if (window.confirm('WARNING: This will completely wipe all SACCO data (Members, Shares, Savings, Investors, Transactions). Are you sure?')) {
                  await useSaccoStore.getState().clearDatabase()
                  window.location.reload()
                }
              }} 
              className="btn-secondary text-red-400 border border-red-500/30 flex items-center gap-2"
            >
              <Trash2 size={16} /> Clear Database & Reload
            </button>
            <button 
              onClick={() => { setTxForm(initialTxForm); setIsTxModalOpen(true) }} 
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> Add Transaction
            </button>
          </div>
        )}
      </div>

      {/* Accounts mini summary cards shown on accounts tab */}
      {activeTab === 'accounts' && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="glass-card p-4 border-l-2 border-emerald-500">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Money in Bank</p>
            <p className="text-base font-bold text-white mt-1">{formatUGX(financials.moneyInBank)}</p>
          </div>
          <div className="glass-card p-4 border-l-2 border-amber-500">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Petty Cash</p>
            <p className="text-base font-bold text-white mt-1">{formatUGX(financials.pettyCash)}</p>
          </div>
          <div className="glass-card p-4 border-l-2 border-purple-500">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Shares Value</p>
            <p className="text-base font-bold text-white mt-1">{formatUGX(financials.totalSharesValue)}</p>
          </div>
          <div className="glass-card p-4 border-l-2 border-indigo-500">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Total Savings</p>
            <p className="text-base font-bold text-white mt-1">{formatUGX(financials.totalSavings)}</p>
          </div>
          <div className="glass-card p-4 border-l-2 border-red-500">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Total Used</p>
            <p className="text-base font-bold text-white mt-1">{formatUGX(financials.totalUsed)}</p>
          </div>
          <div className="glass-card p-4 border-l-2 border-blue-500 col-span-2 md:col-span-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Net Balance</p>
            <p className="text-base font-bold text-white mt-1">{formatUGX(financials.netBalance)}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Side Navigation */}
        <div className="hidden lg:flex lg:flex-col gap-2 w-56 flex-shrink-0">
          <nav className="flex flex-col space-y-1" aria-label="Tabs">
            {[
              { id: 'members', label: `Members (${filteredMembers.length})`, icon: Users },
              { id: 'shares', label: `Shares (${sharesData.length})`, icon: Coins },
              { id: 'savings', label: `Savings (${savingsData.length})`, icon: PiggyBank },
              { id: 'investors', label: `Investors (${investorsData.length})`, icon: TrendingUp },
              { id: 'accounts', label: 'Accounts', icon: Wallet },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`${
                  activeTab === id
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
                } px-4 py-3 text-sm font-semibold rounded-xl text-left flex items-center gap-3 transition-colors`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
          
          <div className="h-px bg-white/10 my-2"></div>
          
          <button 
            onClick={() => setActiveTab('finance')} 
            className={`px-4 py-3 text-sm font-semibold rounded-xl text-left flex items-center gap-3 transition-colors ${activeTab === 'finance' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'}`}
          >
            <DollarSign size={18} /> Farm Finances
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {activeTab === 'finance' ? (
            <div className="glass-card p-6 bg-[#020617]/50 rounded-2xl">
               <Finance />
            </div>
          ) : (
            <div className="space-y-0">
              {/* Search / Filters Bar (not shown in accounts tab) */}
              {activeTab !== 'accounts' && (
                <div className="glass-card p-4 mb-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                      <Search size={16} className="text-slate-400 flex-shrink-0" />
                      <input 
                        type="text" 
                        placeholder={activeTab === 'members' ? "Search members by name, phone or NIN..." : "Search by member name..."} 
                        className="bg-transparent border-none outline-none w-full text-white placeholder:text-slate-500" 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                      />
                    </div>
                    
                    {activeTab === 'members' && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                        <Filter size={16} className="text-slate-400" />
                        <select 
                          className="bg-transparent border-none outline-none text-sm text-white" 
                          value={categoryFilter} 
                          onChange={e => setCategoryFilter(e.target.value)}
                        >
                          <option value="">All Categories</option>
                          <option value="Pioneer">Pioneer</option>
                          <option value="Investor">Investor</option>
                          <option value="Saving Member">Saving Member</option>
                        </select>
                      </div>
                    )}

                    {activeTab !== 'accounts' && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-xs text-slate-400 font-semibold uppercase">FY:</span>
                        <select 
                          className="bg-transparent border-none outline-none text-sm font-semibold text-emerald-400" 
                          value={selectedYear} 
                          onChange={e => setSelectedYear(e.target.value)}
                        >
                          <option value="2026" className="bg-slate-900 text-white">Jan–Dec 2026</option>
                          <option value="2026-2027" className="bg-slate-900 text-white">Jun 2026 – Jun 2027</option>
                          <option value="2027" className="bg-slate-900 text-white">Jan–Dec 2027</option>
                          <option value="2027-2028" className="bg-slate-900 text-white">Jun 2027 – Jun 2028</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab Specific Views */}
              {activeTab === 'members' && (
                <DataTable columns={memberColumns} data={filteredMembers} pageSize={10} />
              )}

              {activeTab === 'shares' && (
                <DataTable columns={sharesColumns} data={sharesData} pageSize={10} />
              )}

              {activeTab === 'savings' && (
                <DataTable columns={savingsColumns} data={savingsData} pageSize={10} />
              )}

              {activeTab === 'investors' && (
                <DataTable columns={investorsColumns} data={investorsData} pageSize={10} />
              )}

              {activeTab === 'accounts' && (() => {
                const today = format(new Date(), 'yyyy-MM-dd')
                const incomeTx = transactions.filter(t => t.type === 'Income')
                const allUnbanked = incomeTx.filter(t => !t.isBanked).reduce((s, t) => s + (Number(t.amount) || 0), 0)

                const dailyList = incomeTx.filter(t => t.date >= today)
                const dailyTotal = dailyList.reduce((s, t) => s + (Number(t.amount) || 0), 0)
                const dailyBanked = dailyList.filter(t => t.isBanked).reduce((s, t) => s + (Number(t.amount) || 0), 0)
                const dailyUnbanked = dailyTotal - dailyBanked
                const daily = { total: dailyTotal, banked: dailyBanked, unbanked: dailyUnbanked, count: dailyList.length }

                const byMethod = {}
                incomeTx.filter(t => !t.isBanked).forEach(t => {
                  const pm = t.paymentMethod || 'Cash'
                  byMethod[pm] = (byMethod[pm] || 0) + (Number(t.amount) || 0)
                })

                return (
                  <div className="space-y-6">
                    {/* Period Summary Cards */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <TrendingUp size={14} /> Income Summary (All Types: Savings, Shares, Investments)
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {[
                          { label: 'Today', data: daily }
                        ].map(({ label, data }) => (
                          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
                            <p className="text-xl font-bold text-white">{formatUGX(data.total)}</p>
                            <div className="w-full bg-white/10 rounded-full h-1.5">
                              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: data.total > 0 ? `${Math.min(100, (data.banked / data.total) * 100).toFixed(0)}%` : '0%' }} />
                            </div>
                            <div className="flex justify-between text-[10px] font-medium">
                              <span className="text-emerald-400">✓ Banked: {formatUGX(data.banked)}</span>
                              <span className="text-orange-400">⚠ Unbanked: {formatUGX(data.unbanked)}</span>
                            </div>
                            <p className="text-[10px] text-slate-500">{data.count} transaction{data.count !== 1 ? 's' : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Unbanked by Payment Method */}
                    {allUnbanked > 0 && (
                      <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                            <Wallet size={14} /> Cash / MM On Hand (Not Yet Banked)
                          </h3>
                          <span className="text-lg font-bold text-orange-300">{formatUGX(allUnbanked)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(byMethod).map(([pm, amt]) => (
                            <div key={pm} className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${PM_COLOR[pm] || PM_COLOR['Other']}`}>
                              <span>{pm}:</span>
                              <span className="font-bold">{formatUGX(amt)}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-orange-400/70 mt-2">⚠ Action required: This money has not been deposited to the bank yet.</p>
                      </div>
                    )}

                    {/* Full Transaction Ledger */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <DollarSign size={14} /> All Transactions Ledger
                      </h3>
                      <DataTable columns={txColumns} data={txData} pageSize={15} />
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Member Modal */}
      <MemberDetailsModal 
        isOpen={isDetailsModalOpen} 
        onClose={() => setIsDetailsModalOpen(false)} 
        memberId={detailedMemberId} 
      />

      {/* Member Form Modal */}
      <Modal 
        isOpen={isMemberModalOpen} 
        onClose={() => setIsMemberModalOpen(false)} 
        title={editingMember ? "Edit SACCO Member" : "Add New SACCO Member"}
      >
        <form onSubmit={handleSaveMember} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col items-center pb-2 border-b border-white/5">
              <label className="block text-xs font-medium text-slate-400 mb-2">Profile Image</label>
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                  {memberForm.photo ? (
                    <img src={memberForm.photo} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Users size={32} className="text-slate-500" />
                  )}
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  id="photo-upload" 
                  onChange={handlePhotoUpload} 
                  className="hidden" 
                />
                <label 
                  htmlFor="photo-upload" 
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-medium rounded-2xl cursor-pointer transition-opacity"
                >
                  Upload
                </label>
              </div>
            </div>
            
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
              <input 
                required 
                type="text" 
                className="input-field" 
                placeholder="e.g. John Doe"
                value={memberForm.name} 
                onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} 
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
              <input 
                type="tel" 
                className="input-field" 
                placeholder="e.g. +25670..."
                value={memberForm.phone} 
                onChange={e => setMemberForm({ ...memberForm, phone: e.target.value })} 
              />
            </div>

            <div className="col-span-2 space-y-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Categories *</label>
              <div className="flex flex-wrap gap-4">
                {['Saving Member', 'Investor', 'Pioneer'].map(cat => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded accent-emerald-500"
                      checked={memberForm.category?.includes(cat) || false}
                      onChange={(e) => {
                        const currentCats = memberForm.category || [];
                        if (e.target.checked) {
                          setMemberForm({...memberForm, category: [...currentCats, cat]})
                        } else {
                          setMemberForm({...memberForm, category: currentCats.filter(c => c !== cat)})
                        }
                      }}
                    />
                    <span className="text-sm font-medium text-slate-300">{cat}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">NIN (National ID)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. CM123..."
                value={memberForm.nin} 
                onChange={e => setMemberForm({ ...memberForm, nin: e.target.value })} 
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Correct Balance (30th Jan 2026)</label>
              <input 
                type="number" 
                className="input-field" 
                value={memberForm.correctBalance} 
                onChange={e => setMemberForm({ ...memberForm, correctBalance: e.target.value })} 
              />
            </div>

            {/* Financials Overview */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Total</label>
              <input type="number" className="input-field bg-slate-800" value={memberForm.total} onChange={e => setMemberForm({ ...memberForm, total: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">No. Of Shares</label>
              <input type="number" className="input-field bg-slate-800" value={memberForm.noOfShares} onChange={e => setMemberForm({ ...memberForm, noOfShares: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Admin Fee</label>
              <input type="number" className="input-field bg-slate-800" value={memberForm.admin} onChange={e => setMemberForm({ ...memberForm, admin: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Savings</label>
              <input type="number" className="input-field bg-slate-800" value={memberForm.savings} onChange={e => setMemberForm({ ...memberForm, savings: e.target.value })} />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-2">Category * (select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {['Saving Member', 'Pioneer', 'Investor'].map(cat => {
                  const selected = Array.isArray(memberForm.category) 
                    ? memberForm.category.includes(cat) 
                    : memberForm.category === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        const current = Array.isArray(memberForm.category) ? memberForm.category : [memberForm.category]
                        const updated = selected ? current.filter(c => c !== cat) : [...current, cat]
                        setMemberForm({ ...memberForm, category: updated.length ? updated : [cat] })
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        selected 
                          ? cat === 'Investor' ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' 
                            : cat === 'Pioneer' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
            <button type="button" className="btn-secondary" onClick={() => setIsMemberModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Member</button>
          </div>
        </form>
      </Modal>

      {/* Adjust Shares Modal */}
      <Modal 
        isOpen={isSharesModalOpen} 
        onClose={() => setIsSharesModalOpen(false)} 
        title={`Adjust Shares: ${editingSharesMember?.name}`}
        size="sm"
      >
        <form onSubmit={handleSaveShares} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Number of Shares *</label>
            <input 
              required 
              type="number" 
              min="1" 
              className="input-field font-bold text-lg text-white" 
              value={shareCountInput} 
              onChange={e => setShareCountInput(e.target.value)} 
            />
            <p className="text-xs text-slate-500 mt-1">Minimum 1 share is required. Each share costs <span className="text-slate-300 font-medium">UGX 100,000</span>.</p>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">Total Value:</span>
            <span className="text-sm font-bold text-white">{formatUGX((Number(shareCountInput) || 1) * 100000)}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {['Cash','MTN MM','Airtel MM','Bank','Cheque','Other'].map(m => (
                <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    paymentMethod === m ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                  }`}>{m}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
            <div>
              <p className="text-xs font-semibold text-white">Already Banked?</p>
              <p className="text-[10px] text-slate-500">Toggle on if cash/MM has already been deposited to bank</p>
            </div>
            <button type="button" onClick={() => setIsBanked(!isBanked)}
              className={`w-10 h-5 rounded-full transition-colors relative ${ isBanked ? 'bg-emerald-500' : 'bg-white/20'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ isBanked ? 'translate-x-5' : ''}`}/>
            </button>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
            <button type="button" className="btn-secondary" onClick={() => setIsSharesModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Update Shares</button>
          </div>
        </form>
      </Modal>

      {/* Deposit/Withdraw Savings Modal */}
      <Modal
        isOpen={isSavingsModalOpen}
        onClose={() => setIsSavingsModalOpen(false)}
        title={`Manage Savings: ${editingSavingsMember?.name}`}
        size="sm"
      >
        <form onSubmit={handleSaveSavings} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Operation Type</label>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setSavingsMode('deposit')}
                className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${savingsMode === 'deposit' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'}`}
              >
                Deposit Savings
              </button>
              <button 
                type="button"
                onClick={() => setSavingsMode('withdraw')}
                className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${savingsMode === 'withdraw' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'}`}
              >
                Withdraw Savings
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Amount (UGX) *</label>
            <input 
              required 
              type="number" 
              min="1" 
              placeholder="e.g. 50000"
              className="input-field text-white font-bold" 
              value={savingsInput} 
              onChange={e => setSavingsInput(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {['Cash','MTN MM','Airtel MM','Bank','Cheque','Other'].map(m => (
                <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    paymentMethod === m ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                  }`}>{m}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
            <div>
              <p className="text-xs font-semibold text-white">Already Banked?</p>
              <p className="text-[10px] text-slate-500">Toggle on if cash/MM has already been deposited to bank</p>
            </div>
            <button type="button" onClick={() => setIsBanked(!isBanked)}
              className={`w-10 h-5 rounded-full transition-colors relative ${ isBanked ? 'bg-emerald-500' : 'bg-white/20'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ isBanked ? 'translate-x-5' : ''}`}/>
            </button>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
            <button type="button" className="btn-secondary" onClick={() => setIsSavingsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      </Modal>

      {/* Convert Savings to Shares Modal */}
      <Modal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        title={`Convert Savings to Shares: ${editingConvertMember?.name}`}
        size="sm"
      >
        <form onSubmit={handleSaveConvert} className="space-y-4">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
            <p className="text-xs text-slate-400">Available Savings:</p>
            <p className="text-lg font-bold text-blue-400">{formatUGX(editingConvertMember?.savingAmount || 0)}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Number of Shares to Purchase</label>
            <input 
              required 
              type="number" 
              min="1" 
              max={Math.floor((editingConvertMember?.savingAmount || 0) / 100000)}
              className="input-field font-bold text-white text-lg" 
              value={convertSharesInput} 
              onChange={e => setConvertSharesInput(e.target.value)} 
            />
            <p className="text-xs text-slate-500 mt-1">Each share costs <span className="text-slate-300 font-medium">UGX 100,000</span>.</p>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-purple-400">Cost:</span>
              <span className="text-white font-semibold">{(Number(convertSharesInput) * 100000).toLocaleString()} UGX</span>
            </div>
            <div className="flex justify-between text-xs border-t border-white/5 pt-2">
              <span className="text-purple-400">Remaining Savings:</span>
              <span className="text-slate-300 font-semibold">{Math.max(0, (editingConvertMember?.savingAmount || 0) - (Number(convertSharesInput) * 100000)).toLocaleString()} UGX</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
            <button type="button" className="btn-secondary" onClick={() => setIsConvertModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary bg-purple-600 hover:bg-purple-700">Convert Now</button>
          </div>
        </form>
      </Modal>

      {/* Configure Investor Modal */}
      <Modal 
        isOpen={isInvestorModalOpen} 
        onClose={() => setIsInvestorModalOpen(false)} 
        title={`Configure Investor: ${editingInvestor?.name}`}
      >
        <form onSubmit={handleSaveInvestor} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Investor Type</label>
              <select 
                className="input-field" 
                value={investorForm.investorType || investorForm.category} 
                onChange={e => setInvestorForm({ ...investorForm, investorType: e.target.value, category: e.target.value })}
              >
                <option value="Money Maker">Money Maker</option>
                <option value="New Farmer">New Farmer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Investment Phase</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. Phase 1, Phase 3..."
                value={investorForm.investmentPhase} 
                onChange={e => setInvestorForm({ ...investorForm, investmentPhase: e.target.value })} 
              />
            </div>
          </div>

          {/* Marketing Strategy Toggle */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
            <input 
              type="checkbox" 
              id="marketing-strategy-toggle"
              className="w-4 h-4 rounded accent-yellow-500"
              checked={investorForm.marketingStrategy || false}
              onChange={e => setInvestorForm({ ...investorForm, marketingStrategy: e.target.checked })}
            />
            <div>
              <label htmlFor="marketing-strategy-toggle" className="text-sm font-semibold text-yellow-400 cursor-pointer">Marketing Strategy</label>
              <p className="text-[10px] text-slate-500">Their number is shown but money is NOT counted in financial totals.</p>
            </div>
          </div>

          {(investorForm.investorType || investorForm.category) === 'Money Maker' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Investment Amount (UGX) *</label>
                <input 
                  required 
                  type="number" 
                  className="input-field font-bold text-white" 
                  value={investorForm.investmentAmount} 
                  onChange={e => setInvestorForm({ ...investorForm, investmentAmount: e.target.value })} 
                />
                <p className="text-xs text-slate-500 mt-1">One unit = <span className="text-slate-300 font-medium">UGX 8,000,000</span>. At 8M+ this investor is marked <span className="text-emerald-400">Cleared</span>.</p>
              </div>

              <div className={`p-3 rounded-xl border space-y-2 ${
                Number(investorForm.investmentAmount) >= 8000000 
                  ? 'bg-emerald-500/10 border-emerald-500/20' 
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Status:</span>
                  <span className={`font-bold ${Number(investorForm.investmentAmount) >= 8000000 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {Number(investorForm.investmentAmount) >= 8000000 ? '✓ Cleared' : '✗ Not Cleared'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Investment Units:</span>
                  <span className="text-white font-bold">{((Number(investorForm.investmentAmount) || 0) / 8000000).toFixed(2)} Units</span>
                </div>
                <div className="flex justify-between text-xs border-t border-white/5 pt-2">
                  <span className="text-emerald-400 font-medium">Annual Payout (350K/Unit):</span>
                  <span className="text-emerald-400 font-bold">{formatUGX(Math.round(((Number(investorForm.investmentAmount) || 0) / 8000000) * 350000))} / yr</span>
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-400">5-Year Projection Payout:</span>
                <span className="text-sm font-bold text-white">{formatUGX(Math.round(((Number(investorForm.investmentAmount) || 0) / 8000000) * 350000 * 5))}</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Number of Cows Received Every Year *</label>
              <input 
                required 
                type="number" 
                className="input-field" 
                value={investorForm.cowsPerYear} 
                onChange={e => setInvestorForm({ ...investorForm, cowsPerYear: e.target.value })} 
              />
              
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex items-center justify-between mt-4">
                <span className="text-xs font-medium text-indigo-400">Cows After 1 Year:</span>
                <span className="text-sm font-bold text-white">{Number(investorForm.cowsPerYear) || 0} cows</span>
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex items-center justify-between mt-2">
                <span className="text-xs font-medium text-indigo-400">Cows After 5 Years (Projected):</span>
                <span className="text-sm font-bold text-white">{(Number(investorForm.cowsPerYear) || 0) * 5} cows</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
            <button type="button" className="btn-secondary" onClick={() => setIsInvestorModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Settings</button>
          </div>
        </form>
      </Modal>

      {/* Add Sacco Transaction Modal */}
      <Modal 
        isOpen={isTxModalOpen} 
        onClose={() => setIsTxModalOpen(false)} 
        title="Add Sacco Transaction"
      >
        <form onSubmit={handleSaveTx} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Date *</label>
              <input 
                required 
                type="date" 
                className="input-field" 
                value={txForm.date} 
                onChange={e => setTxForm({ ...txForm, date: e.target.value })} 
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Transaction Type *</label>
              <select 
                required 
                className="input-field" 
                value={txForm.type} 
                onChange={e => setTxForm({ ...txForm, type: e.target.value })}
              >
                <option value="Income">Income</option>
                <option value="Transfer">Transfer (e.g. Bank to Petty Cash)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Category *</label>
              <select 
                required 
                className="input-field" 
                value={txForm.category} 
                onChange={e => setTxForm({ ...txForm, category: e.target.value })}
              >
                <option value="Share Purchase">Share Purchase</option>
                <option value="Savings">Savings Deposit</option>
                <option value="Membership Fee">Membership Fee</option>
                <option value="Pioneer Contribution">Pioneer Contribution</option>
                <option value="Investment Deposit">Investment Deposit</option>
                <option value="General Expense">General Expense</option>
                <option value="Investment Payout">Investment Payout</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Amount (UGX) *</label>
              <input 
                required 
                type="number" 
                min="1" 
                placeholder="e.g. 50000"
                className="input-field font-semibold text-white" 
                value={txForm.amount} 
                onChange={e => setTxForm({ ...txForm, amount: e.target.value })} 
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-2">Payment Method *</label>
              <div className="grid grid-cols-3 gap-2">
                {['Cash','MTN MM','Airtel MM','Bank','Cheque','Other'].map(m => (
                  <button key={m} type="button" onClick={() => setTxForm({ ...txForm, paymentMethod: m })}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      txForm.paymentMethod === m ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                    }`}>{m}</button>
                ))}
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <div>
                <p className="text-xs font-semibold text-white">Already Banked?</p>
                <p className="text-[10px] text-slate-500">Toggle on if this money is already in the bank account</p>
              </div>
              <button type="button" onClick={() => setTxForm({ ...txForm, isBanked: !txForm.isBanked })}
                className={`w-10 h-5 rounded-full transition-colors relative ${ txForm.isBanked ? 'bg-emerald-500' : 'bg-white/20'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ txForm.isBanked ? 'translate-x-5' : ''}`}/>
              </button>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
              <textarea 
                className="input-field h-20 bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none w-full" 
                placeholder="Transaction details..."
                value={txForm.description} 
                onChange={e => setTxForm({ ...txForm, description: e.target.value })} 
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
            <button type="button" className="btn-secondary" onClick={() => setIsTxModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Transaction</button>
          </div>
        </form>
      </Modal>

      {/* Confirm Dialogs */}
      <ConfirmDialog 
        isOpen={isDeleteOpen} 
        onClose={() => setIsDeleteOpen(false)} 
        onConfirm={async () => {
          if (selectedItem) {
            await deleteMember(selectedItem.id)
            setSelectedItem(null)
          }
        }} 
        title="Delete SACCO Member?" 
        message={`Are you sure you want to delete ${selectedItem?.name}? This will remove all their shares and investor settings.`} 
      />

      <ConfirmDialog 
        isOpen={isTxDeleteOpen} 
        onClose={() => setIsTxDeleteOpen(false)} 
        onConfirm={async () => {
          if (selectedItem) {
            await deleteTransaction(selectedItem.id)
            setSelectedItem(null)
          }
        }} 
        title="Delete Transaction?" 
        message="Are you sure you want to permanently delete this financial record from the ledger?" 
      />
    </div>
  )
}
