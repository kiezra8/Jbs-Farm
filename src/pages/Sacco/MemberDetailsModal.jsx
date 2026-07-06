import { useState, useEffect } from 'react'
import Modal from '../../components/ui/Modal'
import { Users, Coins, PiggyBank, TrendingUp, Save } from 'lucide-react'
import { formatUGX } from '../../utils/formatters'
import { useSaccoStore } from '../../store/useSaccoStore'

export default function MemberDetailsModal({ isOpen, onClose, memberId }) {
  const { 
    members, shares, savings, investors, 
    updateMember, updateShares, updateSavings, convertSavingsToShares, updateInvestor 
  } = useSaccoStore()

  const [activeTab, setActiveTab] = useState('biodata')
  
  // Local state for forms
  const [biodata, setBiodata] = useState({ name: '', phone: '', nin: '', category: 'Saving Member', photo: '' })
  const [shareCount, setShareCount] = useState('1')
  const [savingsAmt, setSavingsAmt] = useState('0')
  const [savingsMode, setSavingsMode] = useState('deposit')
  const [convertAmt, setConvertAmt] = useState('1')
  const [investorData, setInvestorData] = useState({ category: 'Money Maker', investmentAmount: '8000000', cowsPerYear: '0' })

  const member = members.find(m => m.id === memberId)
  const memberShares = shares.find(s => s.memberId === memberId)
  const memberSavings = savings.find(s => s.memberId === memberId)
  const memberInvestor = investors.find(i => i.memberId === memberId)

  useEffect(() => {
    if (member) {
      setBiodata({
        name: member.name || '',
        phone: member.phone || '',
        nin: member.nin || '',
        category: member.category || 'Saving Member',
        photo: member.photo || ''
      })
      setShareCount(String(memberShares?.shareCount || 1))
      setSavingsAmt('')
      setConvertAmt('1')
      if (memberInvestor) {
        setInvestorData({
          category: memberInvestor.category || 'Money Maker',
          investmentAmount: String(memberInvestor.investmentAmount || '8000000'),
          cowsPerYear: String(memberInvestor.cowsPerYear || '0')
        })
      }
    }
  }, [member, memberShares, memberSavings, memberInvestor])

  if (!member) return null

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
    await updateShares(member.id, shareCount)
    alert('Shares updated successfully!')
  }

  const handleSaveSavings = async (e) => {
    e.preventDefault()
    const current = memberSavings?.savingAmount || 0
    const delta = Number(savingsAmt) || 0
    const finalAmount = savingsMode === 'deposit' ? current + delta : Math.max(0, current - delta)
    await updateSavings(member.id, finalAmount)
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

  const handleSaveInvestor = async (e) => {
    e.preventDefault()
    if (memberInvestor) {
      await updateInvestor(memberInvestor.id, {
        category: investorData.category,
        investmentAmount: Number(investorData.investmentAmount) || 8000000,
        cowsPerYear: Number(investorData.cowsPerYear) || 0
      })
      alert('Investor details updated successfully!')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Member Details: ${member.name}`} size="lg">
      <div className="flex border-b border-white/10 overflow-x-auto scrollbar-none mb-4">
        <button type="button" onClick={() => setActiveTab('biodata')} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'biodata' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}><Users size={16}/> Biodata</button>
        <button type="button" onClick={() => setActiveTab('shares')} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'shares' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}><Coins size={16}/> Shares</button>
        <button type="button" onClick={() => setActiveTab('savings')} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'savings' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}><PiggyBank size={16}/> Savings</button>
        {biodata.category === 'Investor' && (
          <button type="button" onClick={() => setActiveTab('investor')} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'investor' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}><TrendingUp size={16}/> Investor</button>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto pr-2">
        {activeTab === 'biodata' && (
          <form onSubmit={handleSaveBiodata} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex flex-col items-center pb-2 border-b border-white/5">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                    {biodata.photo ? <img src={biodata.photo} alt="Preview" className="w-full h-full object-cover" /> : <Users size={32} className="text-slate-500" />}
                  </div>
                  <input type="file" accept="image/*" id="photo-upload-detail" onChange={handlePhotoUpload} className="hidden" />
                  <label htmlFor="photo-upload-detail" className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-medium rounded-2xl cursor-pointer transition-opacity">Upload</label>
                </div>
              </div>
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label><input required type="text" className="input-field" value={biodata.name} onChange={e => setBiodata({...biodata, name: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label><input type="tel" className="input-field" value={biodata.phone} onChange={e => setBiodata({...biodata, phone: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">NIN</label><input type="text" className="input-field" value={biodata.nin} onChange={e => setBiodata({...biodata, nin: e.target.value})} /></div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                <select required className="input-field" value={biodata.category} onChange={e => setBiodata({...biodata, category: e.target.value})}>
                  <option value="Saving Member">Saving Member</option><option value="Pioneer">Pioneer</option><option value="Investor">Investor</option>
                </select>
              </div>
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
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Amount (UGX)</label>
                <input required type="number" min="1" className="input-field" value={savingsAmt} onChange={e => setSavingsAmt(e.target.value)} />
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

        {activeTab === 'investor' && biodata.category === 'Investor' && (
          <form onSubmit={handleSaveInvestor} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Investor Category</label>
              <select className="input-field" value={investorData.category} onChange={e => setInvestorData({...investorData, category: e.target.value})}>
                <option value="Money Maker">Money Maker</option><option value="New Farmer">New Farmer</option>
              </select>
            </div>
            {investorData.category === 'Money Maker' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Investment Amount (UGX)</label>
                <input required type="number" step="100000" className="input-field" value={investorData.investmentAmount} onChange={e => setInvestorData({...investorData, investmentAmount: e.target.value})} />
                <p className="text-xs text-emerald-400 mt-2">Calculated Payout: {formatUGX(((Number(investorData.investmentAmount) || 8000000) / 8000000) * 350000)} / yr</p>
              </div>
            )}
            {investorData.category === 'New Farmer' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Cows per Year</label>
                <input required type="number" className="input-field" value={investorData.cowsPerYear} onChange={e => setInvestorData({...investorData, cowsPerYear: e.target.value})} />
              </div>
            )}
            <div className="flex justify-end pt-4"><button type="submit" className="btn-primary flex gap-2 items-center"><Save size={16}/> Save Investor Profile</button></div>
          </form>
        )}
      </div>
    </Modal>
  )
}
