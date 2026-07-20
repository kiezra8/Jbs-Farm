import { useState, useEffect } from 'react'
import Modal from '../../components/ui/Modal'
import { Users, Coins, PiggyBank, TrendingUp, Save, List, Plus } from 'lucide-react'
import { formatUGX } from '../../utils/formatters'
import { useSaccoStore } from '../../store/useSaccoStore'
import { format } from 'date-fns'

export default function MemberDetailsModal({ isOpen, onClose, memberId }) {
  const { 
    members, shares, savings, investors, 
    updateMember, updateShares, updateSavings, convertSavingsToShares, updateInvestor, getMemberTransactions, addTransaction
  } = useSaccoStore()

  const [activeTab, setActiveTab] = useState('biodata')
  
  // Local state for forms
  const [biodata, setBiodata] = useState({ 
    name: '', phone: '', nin: '', category: 'Saving Member', photo: '',
    correctBalance: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, total: 0, shares: 0,
    admin: 0, savings: 0, mandatory: 0, withdrawable: 0, requested: 0, difference: 0, noOfShares: 0
  })
  const [shareCount, setShareCount] = useState('1')
  const [savingsAmt, setSavingsAmt] = useState('0')
  const [savingsMode, setSavingsMode] = useState('deposit')
  const [convertAmt, setConvertAmt] = useState('1')
  
  // Investor states
  const [investorData, setInvestorData] = useState({ category: 'Money Maker', investorType: 'Money Maker', investmentPhase: 'Initial', marketingStrategy: false })
  const [investorUnits, setInvestorUnits] = useState('1') // 1 unit = 8M
  const [investorPaid, setInvestorPaid] = useState(0)
  
  // Add payment states (used for both Savings and Investor in their respective tabs)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [isBanked, setIsBanked] = useState(false)
  const [investorAddPayment, setInvestorAddPayment] = useState('')

  const member = members.find(m => m.id === memberId)
  const memberShares = shares.find(s => s.memberId === memberId)
  const memberSavings = savings.find(s => s.memberId === memberId)
  const memberInvestor = investors.find(i => i.memberId === memberId)
  const memberTransactions = memberId ? getMemberTransactions(memberId) : []

  // Auto-compute total whenever monthly fields change
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
  const autoTotal = months.reduce((sum, m) => sum + (Number(biodata[m]) || 0), 0)

  const handleMonthChange = (field, value) => {
    const updated = { ...biodata, [field]: value }
    const newTotal = months.reduce((sum, m) => sum + (Number(updated[m]) || 0), 0)
    setBiodata({ ...updated, total: newTotal })
  }

  useEffect(() => {
    if (member) {
      const cats = member.category
      const categoryArray = Array.isArray(cats) ? cats : (cats ? [cats] : ['Saving Member'])
      setBiodata({
        name: member.name || '', phone: member.phone || '', nin: member.nin || '', 
        category: categoryArray,
        photo: member.photo || '',
        correctBalance: member.correctBalance || 0, jan: member.jan || 0, feb: member.feb || 0, mar: member.mar || 0, apr: member.apr || 0, may: member.may || 0, jun: member.jun || 0,
        jul: member.jul || 0, aug: member.aug || 0, sep: member.sep || 0, oct: member.oct || 0, nov: member.nov || 0, dec: member.dec || 0, total: member.total || 0,
        shares: member.shares || 0, admin: member.admin || 0, savings: member.savings || 0, mandatory: member.mandatory || 0, withdrawable: member.withdrawable || 0,
        requested: member.requested || 0, difference: member.difference || 0, noOfShares: member.noOfShares || 0
      })
      setShareCount(String(memberShares?.shareCount || 1))
      setSavingsAmt('')
      setConvertAmt('1')
      setPaymentMethod('Cash')
      setIsBanked(false)
      setInvestorAddPayment('')

      if (memberInvestor) {
        setInvestorData({
          category: memberInvestor.investorType || memberInvestor.category || 'Money Maker',
          investorType: memberInvestor.investorType || memberInvestor.category || 'Money Maker',
          investmentPhase: memberInvestor.investmentPhase || 'Initial',
          marketingStrategy: memberInvestor.marketingStrategy || false,
        })
        const target = memberInvestor.programAmount || memberInvestor.investmentAmount || 8000000
        setInvestorUnits(String(Math.ceil(target / 8000000) || 1))
        setInvestorPaid(Number(memberInvestor.investmentAmount) || 0)
      } else {
        setInvestorUnits('1')
        setInvestorPaid(0)
      }
    }
  }, [member, memberShares, memberSavings, memberInvestor, isOpen])

  if (!member) return null

  const isInvestor = (Array.isArray(biodata.category) ? biodata.category : [biodata.category]).some(c => ['Investor', 'Money Maker', 'New Farmer', 'Phase 3'].includes(c)) || memberInvestor !== undefined;

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setBiodata(prev => ({ ...prev, photo: reader.result }))
      reader.readAsDataURL(file)
    }
  }

  const handleSaveBiodata = async (e) => {
    e.preventDefault()
    await updateMember(member.id, biodata)
    alert('Biodata updated successfully!')
  }

  const handleSaveShares = async (e) => {
    e.preventDefault()
    const newCount = Number(shareCount) || 1
    const oldCount = memberShares?.shareCount || 1
    await updateShares(member.id, newCount)
    
    if (newCount > oldCount) {
      await addTransaction({
        memberId: member.id,
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'Income',
        source: 'Cash',
        category: 'Share Purchase',
        amount: (newCount - oldCount) * 100000,
        paymentMethod: 'Cash',
        isBanked: false,
        description: `Share purchase for ${member.name} (${oldCount} → ${newCount} shares)`
      })
    }
    alert('Shares updated successfully!')
  }

  const handleSaveSavings = async (e) => {
    e.preventDefault()
    const current = memberSavings?.savingAmount || 0
    const delta = Number(savingsAmt) || 0
    if (delta <= 0) return alert('Enter a valid amount')

    const finalAmount = savingsMode === 'deposit' ? current + delta : Math.max(0, current - delta)
    await updateSavings(member.id, finalAmount)
    
    await addTransaction({
      memberId: member.id,
      date: format(new Date(), 'yyyy-MM-dd'),
      type: savingsMode === 'deposit' ? 'Income' : 'Expense',
      source: isBanked ? 'Bank' : paymentMethod,
      category: 'Savings',
      amount: delta,
      paymentMethod,
      isBanked,
      description: `${savingsMode === 'deposit' ? 'Deposited' : 'Withdrew'} savings for ${member.name}`
    })

    alert(`Savings ${savingsMode === 'deposit' ? 'deposited' : 'withdrawn'} successfully!`)
    setSavingsAmt('')
  }

  const handleConvert = async (e) => {
    e.preventDefault()
    const res = await convertSavingsToShares(member.id, convertAmt)
    if (res.success) {
      alert('Conversion successful!')
      setConvertAmt('1')
    } else {
      alert(res.error || 'Conversion failed.')
    }
  }

  const handleSaveInvestorConfig = async (e) => {
    e.preventDefault()
    const targetAmount = (Number(investorUnits) || 1) * 8000000
    
    if (memberInvestor) {
      await updateInvestor(memberInvestor.id, {
        ...investorData,
        programAmount: targetAmount,
        investmentAmount: investorPaid // ensure we don't wipe out the paid amount
      })
    } else {
      // Create new investor record
      await updateInvestor(crypto.randomUUID(), {
        memberId: member.id,
        ...investorData,
        programAmount: targetAmount,
        investmentAmount: investorPaid
      })
    }
    alert('Investor config saved!')
  }

  const handleAddInvestorPayment = async (e) => {
    e.preventDefault()
    const amountToAdd = Number(investorAddPayment) || 0
    if (amountToAdd <= 0) return alert('Enter a valid payment amount')

    const newPaidAmount = investorPaid + amountToAdd
    const targetAmount = (Number(investorUnits) || 1) * 8000000

    if (memberInvestor) {
      await updateInvestor(memberInvestor.id, {
        investmentAmount: newPaidAmount,
        programAmount: targetAmount
      })
    } else {
      await updateInvestor(crypto.randomUUID(), {
        memberId: member.id,
        ...investorData,
        programAmount: targetAmount,
        investmentAmount: newPaidAmount
      })
    }

    await addTransaction({
      memberId: member.id,
      date: format(new Date(), 'yyyy-MM-dd'),
      type: 'Income',
      source: isBanked ? 'Bank' : paymentMethod,
      category: 'Investment Deposit',
      amount: amountToAdd,
      paymentMethod,
      isBanked,
      description: `Investment payment for ${member.name}`
    })

    setInvestorPaid(newPaidAmount)
    setInvestorAddPayment('')
    alert('Investment payment recorded successfully!')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Member Details: ${member.name}`} size="lg">
      <div className="flex border-b border-white/10 overflow-x-auto scrollbar-none mb-4">
        <button type="button" onClick={() => setActiveTab('biodata')} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'biodata' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}><Users size={16}/> Biodata</button>
        <button type="button" onClick={() => setActiveTab('shares')} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'shares' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}><Coins size={16}/> Shares</button>
        <button type="button" onClick={() => setActiveTab('savings')} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'savings' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}><PiggyBank size={16}/> Savings</button>
        {isInvestor && (
          <button type="button" onClick={() => setActiveTab('investor')} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'investor' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}><TrendingUp size={16}/> Investor</button>
        )}
        <button type="button" onClick={() => setActiveTab('history')} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'history' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}><List size={16}/> History</button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto pr-2">
        {activeTab === 'biodata' && (
          <form onSubmit={handleSaveBiodata} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2 md:col-span-4 flex flex-col items-center pb-2 border-b border-white/5">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                    {biodata.photo ? <img src={biodata.photo} alt="Preview" className="w-full h-full object-cover" /> : <Users size={32} className="text-slate-500" />}
                  </div>
                  <input type="file" accept="image/*" id="photo-upload-detail" onChange={handlePhotoUpload} className="hidden" />
                  <label htmlFor="photo-upload-detail" className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-medium rounded-2xl cursor-pointer transition-opacity">Upload</label>
                </div>
              </div>
              <div className="col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label><input required type="text" className="input-field" value={biodata.name} onChange={e => setBiodata({...biodata, name: e.target.value})} /></div>
                <div><label className="block text-xs font-medium text-slate-400 mb-1">Phone</label><input type="tel" className="input-field" value={biodata.phone} onChange={e => setBiodata({...biodata, phone: e.target.value})} /></div>
                <div><label className="block text-xs font-medium text-slate-400 mb-1">NIN</label><input type="text" className="input-field" value={biodata.nin} onChange={e => setBiodata({...biodata, nin: e.target.value})} /></div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-2">Category (select all that apply)</label>
                  <div className="flex flex-wrap gap-2">
                    {['Saving Member', 'Pioneer', 'Investor'].map(cat => {
                      const catArr = Array.isArray(biodata.category) ? biodata.category : [biodata.category]
                      const selected = catArr.includes(cat)
                      return (
                        <button key={cat} type="button" onClick={() => {
                          const updated = selected ? catArr.filter(c => c !== cat) : [...catArr, cat]
                          setBiodata({...biodata, category: updated.length ? updated : [cat]})
                        }} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          selected 
                            ? cat === 'Investor' ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' 
                              : cat === 'Pioneer' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-white/10 text-white border-white/20'
                            : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'
                        }`}>{cat}</button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Monthly Breakdown with Color Marks */}
              <div className="col-span-2 md:col-span-4 mt-4 mb-2">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <h4 className="text-sm font-semibold text-emerald-400">Monthly Contributions (2026)</h4>
                  <span className="text-xs text-slate-400">Auto-total: <span className="text-emerald-400 font-bold">{autoTotal.toLocaleString()}</span></span>
                </div>
              </div>
              <div className="col-span-2 md:col-span-4">
                <label className="block text-[10px] font-medium text-slate-400 mb-1">Correct Balance (Jan 30)</label>
                <input type="number" className="input-field bg-slate-800" value={biodata.correctBalance} onChange={e => setBiodata({...biodata, correctBalance: e.target.value})} />
              </div>
              {[
                { key: 'jan', label: 'Jan' }, { key: 'feb', label: 'Feb' }, { key: 'mar', label: 'Mar' },
                { key: 'apr', label: 'Apr' }, { key: 'may', label: 'May' }, { key: 'jun', label: 'Jun' },
                { key: 'jul', label: 'Jul' }, { key: 'aug', label: 'Aug' }, { key: 'sep', label: 'Sep' },
                { key: 'oct', label: 'Oct' }, { key: 'nov', label: 'Nov' }, { key: 'dec', label: 'Dec' },
              ].map(({ key, label }) => {
                const paid = Number(biodata[key]) > 0
                return (
                  <div key={key} className={`relative rounded-xl border p-2 transition-all ${paid ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`block text-[10px] font-semibold ${paid ? 'text-emerald-400' : 'text-red-400'}`}>{label}</label>
                      <span className={`text-[8px] font-bold px-1 rounded ${paid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{paid ? '✓' : '✗'}</span>
                    </div>
                    <input type="number" className="w-full bg-transparent text-xs text-white outline-none border-none" value={biodata[key]} onChange={e => handleMonthChange(key, e.target.value)} />
                  </div>
                )
              })}
              
              <div className="col-span-2 md:col-span-4 mt-4 mb-2">
                <h4 className="text-sm font-semibold text-emerald-400 border-b border-white/10 pb-2">Financial Breakdown</h4>
              </div>
              <div className="col-span-2 md:col-span-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs font-medium text-emerald-400">Auto-computed Total</span>
                  <span className="text-lg font-bold text-white">{autoTotal.toLocaleString()}</span>
                </div>
              </div>
              <div><label className="block text-[10px] font-medium text-slate-400 mb-1">Shares Amount</label><input type="number" className="input-field" value={biodata.shares} onChange={e => setBiodata({...biodata, shares: e.target.value})} /></div>
              <div><label className="block text-[10px] font-medium text-slate-400 mb-1">No. Of Shares</label><input type="number" className="input-field" value={biodata.noOfShares} onChange={e => setBiodata({...biodata, noOfShares: e.target.value})} /></div>
              <div><label className="block text-[10px] font-medium text-slate-400 mb-1">Admin</label><input type="number" className="input-field" value={biodata.admin} onChange={e => setBiodata({...biodata, admin: e.target.value})} /></div>
              <div><label className="block text-[10px] font-medium text-slate-400 mb-1">Savings</label><input type="number" className="input-field" value={biodata.savings} onChange={e => setBiodata({...biodata, savings: e.target.value})} /></div>
              <div><label className="block text-[10px] font-medium text-slate-400 mb-1">Mandatory</label><input type="number" className="input-field" value={biodata.mandatory} onChange={e => setBiodata({...biodata, mandatory: e.target.value})} /></div>
              <div><label className="block text-[10px] font-medium text-slate-400 mb-1">Withdrawable</label><input type="number" className="input-field bg-blue-500/10" value={biodata.withdrawable} onChange={e => setBiodata({...biodata, withdrawable: e.target.value})} /></div>
              <div><label className="block text-[10px] font-medium text-slate-400 mb-1">Requested</label><input type="number" className="input-field bg-orange-500/10" value={biodata.requested} onChange={e => setBiodata({...biodata, requested: e.target.value})} /></div>
              <div><label className="block text-[10px] font-medium text-slate-400 mb-1">Difference</label><input type="number" className="input-field bg-red-500/10" value={biodata.difference} onChange={e => setBiodata({...biodata, difference: e.target.value})} /></div>
            </div>
            <div className="flex justify-end pt-4"><button type="submit" className="btn-primary flex gap-2 items-center"><Save size={16}/> Save Biodata</button></div>
          </form>
        )}

        {activeTab === 'shares' && (
          <form onSubmit={handleSaveShares} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Current Shares</label>
              <input required type="number" min="1" className="input-field font-bold text-lg" value={shareCount} onChange={e => setShareCount(e.target.value)} />
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-400">Total Value:</span>
              <span className="text-sm font-bold text-white">{formatUGX((Number(shareCount) || 1) * 100000)}</span>
            </div>
            <div className="flex justify-end pt-4"><button type="submit" className="btn-primary flex gap-2 items-center"><Save size={16}/> Update Shares</button></div>
          </form>
        )}

        {activeTab === 'savings' && (
          <div className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex flex-col items-center">
              <p className="text-xs text-blue-400 mb-1">Current Savings Balance</p>
              <p className="text-2xl font-bold text-white">{formatUGX(memberSavings?.savingAmount || 0)}</p>
            </div>

            <form onSubmit={handleSaveSavings} className="space-y-4 p-4 border border-white/10 rounded-xl">
              <h4 className="font-semibold text-white mb-2">Deposit / Withdraw</h4>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSavingsMode('deposit')} className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${savingsMode === 'deposit' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'}`}>Deposit</button>
                <button type="button" onClick={() => setSavingsMode('withdraw')} className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${savingsMode === 'withdraw' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'}`}>Withdraw</button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Amount (UGX)</label>
                  <input required type="number" min="1" className="input-field" value={savingsAmt} onChange={e => setSavingsAmt(e.target.value)} />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Payment Method</label>
                  <select className="input-field text-xs" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="Cash">Cash</option><option value="Bank">Bank</option><option value="MTN MM">MTN MM</option><option value="Airtel MM">Airtel MM</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input type="checkbox" id="banked-toggle" className="w-4 h-4" checked={isBanked} onChange={e => setIsBanked(e.target.checked)} />
                  <label htmlFor="banked-toggle" className="text-xs text-slate-400">Already in Bank?</label>
                </div>
              </div>
              <div className="flex justify-end"><button type="submit" className="btn-secondary flex gap-2 items-center"><Save size={16}/> Apply Amount</button></div>
            </form>

            <form onSubmit={handleConvert} className="space-y-4 p-4 border border-white/10 rounded-xl">
              <h4 className="font-semibold text-purple-400 mb-2">Convert Savings to Shares</h4>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Number of Shares to Buy</label>
                <input required type="number" min="1" max={Math.floor((memberSavings?.savingAmount || 0) / 100000)} className="input-field" value={convertAmt} onChange={e => setConvertAmt(e.target.value)} />
              </div>
              <p className="text-xs text-slate-500">Cost: {(Number(convertAmt) * 100000).toLocaleString()} UGX</p>
              <div className="flex justify-end"><button type="submit" className="btn-secondary text-purple-400 flex gap-2 items-center border-purple-500/30 hover:bg-purple-500/20"><Coins size={16}/> Convert</button></div>
            </form>
          </div>
        )}

        {activeTab === 'investor' && isInvestor && (
          <div className="space-y-6">
            <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-purple-400 mb-1">Target Amount</p>
                  <p className="text-xl font-bold text-white">{formatUGX((Number(investorUnits) || 1) * 8000000)}</p>
                  <p className="text-[10px] text-slate-400">{investorUnits} Unit(s) of 8M</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-400 mb-1">Total Paid</p>
                  <p className="text-xl font-bold text-white">{formatUGX(investorPaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-red-400 mb-1">Remaining Balance</p>
                  <p className="text-xl font-bold text-white">{formatUGX(Math.max(0, ((Number(investorUnits) || 1) * 8000000) - investorPaid))}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddInvestorPayment} className="space-y-4 p-4 border border-white/10 rounded-xl">
              <h4 className="font-semibold text-emerald-400 mb-2 flex items-center gap-2"><Plus size={16}/> Add Payment</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Amount to Add (UGX)</label>
                  <input required type="number" min="1" className="input-field" value={investorAddPayment} onChange={e => setInvestorAddPayment(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Payment Method</label>
                  <select className="input-field text-xs" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="Cash">Cash</option><option value="Bank">Bank</option><option value="MTN MM">MTN MM</option><option value="Airtel MM">Airtel MM</option><option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input type="checkbox" id="inv-banked-toggle" className="w-4 h-4" checked={isBanked} onChange={e => setIsBanked(e.target.checked)} />
                  <label htmlFor="inv-banked-toggle" className="text-xs text-slate-400">Already in Bank?</label>
                </div>
              </div>
              <div className="flex justify-end"><button type="submit" className="btn-primary flex gap-2 items-center"><Save size={16}/> Record Payment</button></div>
            </form>

            <form onSubmit={handleSaveInvestorConfig} className="space-y-4 pt-4 border-t border-white/10">
              <h4 className="font-semibold text-slate-300">Investor Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Investor Type</label>
                  <select className="input-field" value={investorData.investorType || investorData.category} onChange={e => setInvestorData({...investorData, investorType: e.target.value, category: e.target.value})}>
                    <option value="Money Maker">Money Maker</option><option value="New Farmer">New Farmer</option><option value="Phase 3">Phase 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Investment Phase</label>
                  <input type="text" className="input-field" placeholder="e.g. Phase 1" value={investorData.investmentPhase || ''} onChange={e => setInvestorData({...investorData, investmentPhase: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Units (1 Unit = 8M)</label>
                  <select className="input-field" value={investorUnits} onChange={e => setInvestorUnits(e.target.value)}>
                    <option value="1">1 Unit (8M)</option>
                    <option value="2">2 Units (16M)</option>
                    <option value="3">3 Units (24M)</option>
                    <option value="4">4 Units (32M)</option>
                    <option value="5">5 Units (40M)</option>
                    <option value="10">10 Units (80M)</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                <input type="checkbox" id="mkt-toggle-detail" className="w-4 h-4 rounded accent-yellow-500" checked={investorData.marketingStrategy || false} onChange={e => setInvestorData({...investorData, marketingStrategy: e.target.checked})} />
                <label htmlFor="mkt-toggle-detail" className="text-sm font-semibold text-yellow-400 cursor-pointer">Marketing Strategy <span className="text-[10px] text-slate-500 font-normal">(number shown but money NOT counted)</span></label>
              </div>
              <div className="flex justify-end pt-4"><button type="submit" className="btn-secondary flex gap-2 items-center border-slate-500"><Save size={16}/> Save Configuration</button></div>
            </form>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-300 border-b border-white/10 pb-2">Transaction History</h4>
            {memberTransactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <List size={48} className="mx-auto mb-3 opacity-20" />
                <p>No transactions recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {memberTransactions.map(tx => (
                  <div key={tx.id} className="p-3 rounded-xl border border-white/10 flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors">
                    <div>
                      <p className="text-xs text-slate-400 font-medium">{format(new Date(tx.date), 'dd MMM yyyy')}</p>
                      <p className="font-semibold text-white">{tx.category}</p>
                      <p className="text-[10px] text-slate-400">{tx.description}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tx.type === 'Income' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.type === 'Income' ? '+' : '-'}{formatUGX(tx.amount)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {tx.paymentMethod} {tx.isBanked ? <span className="text-emerald-400">(Banked)</span> : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
