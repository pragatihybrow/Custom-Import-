frappe.ui.form.on("Supplier Quotation", {
    refresh: function(frm) {
        if (frm.doc.taxes_and_charges && (!frm.doc.taxes || frm.doc.taxes.length === 0)) {
            frm.script_manager.trigger("taxes_and_charges");
        }
    }
});
