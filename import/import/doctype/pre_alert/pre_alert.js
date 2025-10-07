// Copyright (c) 2025, Pragati Dike and contributors
// For license information, please see license.txt

frappe.ui.form.on("Pre Alert", {
    pickup_request: function (frm) {
        frappe.call({
            method: "import.import.doctype.pre_alert.pre_alert.get_exchange_rate",
            args: {
                name: frm.doc.pickup_request
            },
            callback: function (r) {
                var exchange_rate = r.message[0][0]['exchange_rate']
                var exchange = r.message[0][0]['currency']
                frm.set_value("currency", exchange)
                frm.set_value("exch_rate", exchange_rate)
                // let total_inr_amount = frm.doc.total_doc_val * exchange_rate
                // frm.set_value("total_inr_val", total_inr_amount)

                // ✅ clear table before adding fresh items
                frm.clear_table("item_details");
                let data = r.message[1]
                data.forEach(function (obj) {
                    var row = frm.add_child("item_details")
                    row.item_code = obj['item'];
                    row.quantity = obj['pick_qty']
                    row.description = obj['material_desc']
                    row.material_name = obj['material']
                    row.po_no = obj['po_number']
                    row.item_price = obj['rate']
                    row.amount = obj['amount']
                    row.po_qty = obj['quantity']
                    row.total_inr_value = obj['amount'] * frm.doc.exch_rate
                })
                frm.refresh_field("item_details")
            }
        })

        frappe.call({
            method: "import.import.doctype.pre_alert.pre_alert.get_attachments",
            args: {
                name: frm.doc.pickup_request
            },
            callback: function (r) {
                // ✅ clear table before adding fresh attachments
                frm.clear_table("attach_document");
                let data = r.message
                data.forEach(function (obj) {
                    var row = frm.add_child("attach_document")
                    row.description = obj['description']
                    row.attach_xswj = obj['attach_file']
                })
                frm.refresh_field("attach_document")
            }
        })
    },

    before_save: function (frm) {
        freight_amt_calculation(frm)
        insurance_calculation(frm)
        other_charges_calculation(frm)
        calculation_tax(frm)
        total_calculations(frm)
        calculation_of_rodtep(frm)
        calculation_used_rodtep(frm)
    },

    insurance: function (frm) {
        if (frm.doc.insurance > 0) {
            let insurance_value = (frm.doc.total_inr_val * frm.doc.insurance) / 100;
            frm.set_value("insurance_amount", insurance_value);
            insurance_calculation(frm, insurance_value);
        }
    },

    insurance_amount: function (frm) {
        if (frm.doc.insurance_amount > 0) {
            let insurance_percentage = (frm.doc.insurance_amount / frm.doc.total_inr_val) * 100;
            frm.set_value("insurance", insurance_percentage);
            insurance_calculation(frm, frm.doc.insurance_amount);
        }
    },

    freight_amt: function (frm) {
        freight_amt_calculation(frm)
    },

    ex_works: function (frm) {
        freight_amt_calculation(frm)
    },

    other_charges: function (frm) {
        other_charges_calculation(frm)
    },

//  refresh: function(frm) {
//         frm.add_custom_button("Pickup Requests", function () {
//             // Fetch all valid Pickup Requests that have RFQ and submitted Supplier Quotation
//             frappe.call({
//                 method: "import.import.doctype.pre_alert.pre_alert.get_valid_pickup_requests_for_pre_alert",
//                 callback: function(response) {
//                     if (!response.message || response.message.length === 0) {
//                         frappe.msgprint("No valid Pickup Requests found. Pickup Requests must have an RFQ and submitted Supplier Quotation.");
//                         return;
//                     }
                    
//                     let valid_pickup_requests = response.message;

//                     let d = new frappe.ui.form.MultiSelectDialog({
//                         doctype: "Pickup Request",
//                         target: frm,
//                         setters: {
//                             port_of_loading_pol: null,
//                             port_of_destination_pod: null,
//                             pickup_date_by: null
//                         },
//                         add_filters_group: 1,
//                         date_field: "pickup_date_by",
//                         columns: ["name", "pickup_date_by", "port_of_loading_pol", "port_of_destination_pod"],
//                         get_query() {
//                             return {
//                                 filters: {
//                                     docstatus: 1,
//                                     name: ["in", valid_pickup_requests]
//                                 }
//                             };
//                         },
//                         action: async function (selections) {
//                             d.dialog.hide();

//                             if (!selections || selections.length === 0) {
//                                 frappe.msgprint("No Pickup Requests selected.");
//                                 return;
//                             }

//                             let selected_data = [];
//                             // Fetch details of all selected Pickup Requests
//                             for (const pr_name of selections) {
//                                 let r = await frappe.call({
//                                     method: "import.import.doctype.pre_alert.pre_alert.get_pickup_request_details",
//                                     args: { pickup_request: pr_name },
//                                     async: true
//                                 });
//                                 if (r.message) {
//                                     selected_data.push({
//                                         name: pr_name,
//                                         vendor: r.message.vendor,
//                                         pol: r.message.port_of_loading_pol,
//                                         pod: r.message.port_of_destination_pod,
//                                         pickup_date: r.message.pickup_date_by,
//                                         currency: r.message.currency,
//                                         conversion_rate: r.message.conversion_rate,
//                                         total_inr_val: r.message.total_inr_val,
//                                         total_doc_val: r.message.total_doc_val,
//                                         items: r.message.items,
//                                         rfqs: r.message.rfqs || []
//                                     });
//                                 }
//                             }

//                             // Validate same vendor, pol, pod, pickup_date, currency
//                             let vendor = selected_data[0].vendor;
//                             let pol = selected_data[0].pol;
//                             let pod = selected_data[0].pod;
//                             let pickup_date = selected_data[0].pickup_date;
//                             let currency = selected_data[0].currency;

//                             for (let pr of selected_data) {
//                                 if (vendor !== pr.vendor) {
//                                     frappe.msgprint(`Pickup Request ${pr.name} has a different Vendor (${pr.vendor})`);
//                                     return;
//                                 }
//                                 if (pol !== pr.pol) {
//                                     frappe.msgprint(`Pickup Request ${pr.name} has a different Port of Loading (${pr.pol})`);
//                                     return;
//                                 }
//                                 if (pod !== pr.pod) {
//                                     frappe.msgprint(`Pickup Request ${pr.name} has a different Port of Destination (${pr.pod})`);
//                                     return;
//                                 }
//                                 if (pickup_date !== pr.pickup_date) {
//                                     frappe.msgprint(`Pickup Request ${pr.name} has a different Pickup Date (${pr.pickup_date})`);
//                                     return;
//                                 }
//                                 if (currency !== pr.currency) {
//                                     frappe.msgprint(`Pickup Request ${pr.name} has a different Currency (${pr.currency}). All must be same.`);
//                                     return;
//                                 }
//                             }

//                             // Clear existing child tables
//                             frm.clear_table("pickup_request");
//                             frm.clear_table("item_details");
//                             frm.clear_table("request_for_quotation"); // RFQ child table

//                             // Add Pickup Requests to child table
//                             selected_data.forEach(pr => {
//                                 let row = frm.add_child("pickup_request");
//                                 row.pickup_request = pr.name;
//                             });

//                             // Add items to child table
//                             selected_data.forEach(pr => {
//                                 pr.items.forEach(item => {
//                                     let item_row = frm.add_child("item_details");
//                                     item_row.item_code = item.item;
//                                     item_row.item_name = item.material;
//                                     item_row.description = item.material_desc;
//                                     item_row.po_no = item.po_number;
//                                     item_row.quantity = item.pick_qty;
//                                     item_row.item_price = item.rate;
//                                     item_row.amount = item.amount;
//                                     item_row.total_inr_value = item.amount_in_inr;
//                                 });
//                             });

//                             selected_data.forEach(pr => {
//                                 pr.rfqs.forEach(rfq => {
//                                     let exists = (frm.doc.rfq_number || []).some(r => r.request_for_quotation === rfq.request_for_quotation);
//                                     if (!exists) {
//                                         let rfq_row = frm.add_child("rfq_number");
//                                         rfq_row.request_for_quotation = rfq.request_for_quotation;
//                                     }
//                                 });
//                             });


//                             // Set parent-level fields
//                             frm.set_value("vendor", vendor);
//                             frm.set_value("currency", currency);
//                             frm.set_value("exch_rate", selected_data[0].conversion_rate);

//                             // Sum totals of all selected Pickup Requests
//                             let total_inr_val = 0;
//                             let total_doc_val = 0;
//                             selected_data.forEach(pr => {
//                                 total_inr_val += pr.total_inr_val || 0;
//                                 total_doc_val += pr.total_doc_val || 0;
//                             });

//                             frm.set_value("total_inr_val", total_inr_val);
//                             frm.set_value("total_doc_val", total_doc_val);

//                             // Refresh fields
//                             frm.refresh_field("pickup_request");
//                             frm.refresh_field("item_details");
//                             frm.refresh_field("rfq_number");

//                             frm.save();
//                         }
//                     });

//                     d.dialog.show();
//                 }
//             });
//         }, __("Get Items"));
    
 refresh: function(frm) {
        frm.add_custom_button("Pickup Requests", function () {
            // Fetch all valid Pickup Requests that have RFQ and submitted Supplier Quotation
            frappe.call({
                method: "import.import.doctype.pre_alert.pre_alert.get_valid_pickup_requests_for_pre_alert",
                callback: function(response) {
                    if (!response.message || response.message.length === 0) {
                        frappe.msgprint("No valid Pickup Requests found. Pickup Requests must have an RFQ and submitted Supplier Quotation.");
                        return;
                    }

                    let valid_pickup_requests = response.message;

                    let d = new frappe.ui.form.MultiSelectDialog({
                        doctype: "Pickup Request",
                        target: frm,
                        setters: {
                            port_of_loading_pol: null,
                            port_of_destination_pod: null,
                            pickup_date_by: null
                        },
                        add_filters_group: 1,
                        date_field: "pickup_date_by",
                        columns: ["name", "pickup_date_by", "port_of_loading_pol", "port_of_destination_pod"],
                        get_query() {
                            return {
                                filters: {
                                    docstatus: 1,
                                    name: ["in", valid_pickup_requests]
                                }
                            };
                        },
                        action: async function (selections) {
                            d.dialog.hide();

                            if (!selections || selections.length === 0) {
                                frappe.msgprint("No Pickup Requests selected.");
                                return;
                            }

                            let selected_data = [];
                            // Fetch details of all selected Pickup Requests
                            for (const pr_name of selections) {
                                let r = await frappe.call({
                                    method: "import.import.doctype.pre_alert.pre_alert.get_pickup_request_details",
                                    args: { pickup_request: pr_name },
                                    async: true
                                });
                                if (r.message) {
                                    selected_data.push({
                                        name: pr_name,
                                        vendor: r.message.vendor,
                                        pol: r.message.port_of_loading_pol,
                                        pod: r.message.port_of_destination_pod,
                                        pickup_date: r.message.pickup_date_by,
                                        currency: r.message.currency,
                                        conversion_rate: r.message.conversion_rate,
                                        total_inr_val: r.message.total_inr_val,
                                        total_doc_val: r.message.total_doc_val,
                                        items: r.message.items,
                                        rfqs: r.message.rfqs || []
                                    });
                                }
                            }

                            // Validate same vendor, pol, pod, pickup_date, currency
                            let vendor = selected_data[0].vendor;
                            let pol = selected_data[0].pol;
                            let pod = selected_data[0].pod;
                            let pickup_date = selected_data[0].pickup_date;
                            let currency = selected_data[0].currency;

                            for (let pr of selected_data) {
                                if (vendor !== pr.vendor) {
                                    frappe.msgprint(`Pickup Request ${pr.name} has a different Vendor (${pr.vendor})`);
                                    return;
                                }
                                if (pol !== pr.pol) {
                                    frappe.msgprint(`Pickup Request ${pr.name} has a different Port of Loading (${pr.pol})`);
                                    return;
                                }
                                if (pod !== pr.pod) {
                                    frappe.msgprint(`Pickup Request ${pr.name} has a different Port of Destination (${pr.pod})`);
                                    return;
                                }
                                if (pickup_date !== pr.pickup_date) {
                                    frappe.msgprint(`Pickup Request ${pr.name} has a different Pickup Date (${pr.pickup_date})`);
                                    return;
                                }
                                if (currency !== pr.currency) {
                                    frappe.msgprint(`Pickup Request ${pr.name} has a different Currency (${pr.currency}). All must be same.`);
                                    return;
                                }
                            }

                            // Clear existing Pickup Requests and Items child tables
                            frm.clear_table("pickup_request");
                            frm.clear_table("item_details");

                            // Add Pickup Requests to child table
                            selected_data.forEach(pr => {
                                let row = frm.add_child("pickup_request");
                                row.pickup_request = pr.name;
                            });

                            // Add items to child table
                            selected_data.forEach(pr => {
                                pr.items.forEach(item => {
                                    let item_row = frm.add_child("item_details");
                                    item_row.item_code = item.item;
                                    item_row.item_name = item.material;
                                    item_row.description = item.material_desc;
                                    item_row.po_no = item.po_number;
                                    item_row.quantity = item.pick_qty;
                                    item_row.item_price = item.rate;
                                    item_row.amount = item.amount;
                                    item_row.total_inr_value = item.amount_in_inr;
                                });
                            });

                            // ---- RFQ handling ----
                            let rfq_set = new Set();
                            selected_data.forEach(pr => {
                                pr.rfqs.forEach(rfq => rfq_set.add(rfq.request_for_quotation));
                            });

                                                    // Remove RFQs that are no longer linked
                            let rfq_table = frm.doc.rfq_number || [];
                            for (let i = rfq_table.length - 1; i >= 0; i--) {  // iterate backwards
                                if (!rfq_set.has(rfq_table[i].request_for_quotation)) {
                                    frm.doc.rfq_number.splice(i, 1);
                                }
                            }
                            frm.refresh_field("rfq_number");


                            // Add missing RFQs
                            rfq_set.forEach(rfq_name => {
                                let exists = (frm.doc.rfq_number || []).some(r => r.request_for_quotation === rfq_name);
                                if (!exists) {
                                    let rfq_row = frm.add_child("rfq_number");
                                    rfq_row.request_for_quotation = rfq_name;
                                }
                            });

                            frm.refresh_field("pickup_request");
                            frm.refresh_field("item_details");
                            frm.refresh_field("rfq_number");

                            // Set parent-level fields
                            frm.set_value("vendor", vendor);
                            frm.set_value("currency", currency);
                            frm.set_value("exch_rate", selected_data[0].conversion_rate);

                            // Sum totals of all selected Pickup Requests
                            let total_inr_val = 0;
                            let total_doc_val = 0;
                            selected_data.forEach(pr => {
                                total_inr_val += pr.total_inr_val || 0;
                                total_doc_val += pr.total_doc_val || 0;
                            });

                            frm.set_value("total_inr_val", total_inr_val);
                            frm.set_value("total_doc_val", total_doc_val);

                            // Save the form
                            frm.save();
                        }
                    });

                    d.dialog.show();
                }
            });
        }, __("Get Items"));

        frm.add_custom_button("Calculate", function (obj) {
            freight_amt_calculation(frm)
            insurance_calculation(frm)
            other_charges_calculation(frm)
            calculation_tax(frm)
            total_calculations(frm)
            calculation_of_rodtep(frm)
        })
        
        
    },

    // total_doc_val: function (frm) {
    //     var total_inr = frm.doc.exch_rate * frm.doc.total_doc_val
    //     frm.set_value("total_inr_val", total_inr)
    // },

    igcr: function (frm) {
        if (frm.doc.igcr == 1) {
            $.each(frm.doc.item_details || [], function (i, d) {
                d.igcr = 1
                d.category = 9
                let hsn_code = d.hsn_code
                let category = d.category
                get_percentage_of_hsn_and_category_base(frm, d, hsn_code, category)
            })
            frm.refresh_field("item_details")
        }
    },

    on_submit: function (frm) {
        update_rodtep_base_on_used(frm)
        // send_email_to_cha(frm)
    },
});

frappe.ui.form.on("Pre-Alert Item Details", {
    category: function (frm, cdt, cdn) {
        var row = locals[cdt][cdn]
        let hsn_code = row.hsn_code
        let category = row.category
        get_percentage_of_hsn_and_category_base(frm, row, hsn_code, category)
    }
})


function get_percentage_of_hsn_and_category_base(frm, row_or_d, hsn_code, category) {
    if (hsn_code != undefined && category != undefined) {
        frappe.call({
            method: "import.import.doctype.pre_alert.pre_alert.get_percentage_of_hsn_and_category_base",
            args: {
                name: hsn_code,
                category: category
            },
            callback: function (response) {
                var data = response.message
                data.forEach(function (obj) {
                    row_or_d.bcd_ = obj['bcd']
                    row_or_d.hcs_ = obj['hcs']
                    row_or_d.swl_ = obj['swl']
                    row_or_d.igst_ = obj['igst']
                })
                calculation_tax(frm)
                total_calculations(frm)
                frm.refresh_field("item_details")
            }
        })
    }
}


function freight_amt_calculation(frm) {
    let total_value = 0;
    let freight_amt = isNaN(frm.doc.freight_amt) || frm.doc.freight_amt == null ? 0 : frm.doc.freight_amt;
    let ex_work = isNaN(frm.doc.ex_works) || frm.doc.ex_works == null ? 0 : frm.doc.ex_works;
    let total_charge = freight_amt + ex_work

    frm.doc.item_details.forEach(item => {
        total_value += item.total_inr_value;
    });

    frm.doc.item_details.forEach(item => {
        let item_charge = (item.total_inr_value / total_value) * total_charge;
        frappe.model.set_value(item.doctype, item.name, 'freight_amount', item_charge);
        let total_inr_value = isNaN(item.total_inr_value) || item.total_inr_value == null ? 0 : item.total_inr_value;
        let freight_amount = isNaN(item.freight_amount) || item.freight_amount == null ? 0 : item.freight_amount;
        let insurance_amount = isNaN(item.insurance_amount) || item.insurance_amount == null ? 0 : item.insurance_amount;
        let misc_charge_amt = isNaN(item.misc_charge_amt) || item.misc_charge_amt == null ? 0 : item.misc_charge_amt;

        let total_amount = total_inr_value + freight_amount + insurance_amount + misc_charge_amt;

        frappe.model.set_value(item.doctype, item.name, 'total_amount', total_amount);

    });

    frm.refresh_field('item_details');
}

function insurance_calculation(frm, insurance_value) {
    let total_value = 0;

    frm.doc.item_details.forEach(item => {
        total_value += item.total_inr_value;
    });

    frm.doc.item_details.forEach(item => {
        let item_charge = (item.total_inr_value / total_value) * insurance_value;
        frappe.model.set_value(item.doctype, item.name, 'insurance_amount', item_charge);
        let total_inr_value = isNaN(item.total_inr_value) || item.total_inr_value == null ? 0 : item.total_inr_value;
        let freight_amount = isNaN(item.freight_amount) || item.freight_amount == null ? 0 : item.freight_amount;
        let insurance_amount = isNaN(item.insurance_amount) || item.insurance_amount == null ? 0 : item.insurance_amount;
        let misc_charge_amt = isNaN(item.misc_charge_amt) || item.misc_charge_amt == null ? 0 : item.misc_charge_amt;

        let total_amount = total_inr_value + freight_amount + insurance_amount + misc_charge_amt;

        frappe.model.set_value(item.doctype, item.name, 'total_amount', total_amount);

    });
    frm.refresh_field('item_details');
}

function other_charges_calculation(frm) {
    let total_value = 0
    let other_charges = frm.doc.other_charges
    frm.doc.item_details.forEach(item => {
        total_value += item.total_inr_value;
    });
    frm.doc.item_details.forEach(item => {
        let misc_charge_amt = (item.total_inr_value / total_value) * other_charges
        if (isNaN(misc_charge_amt)) {
            misc_charge_amt = 0;
        }
        frappe.model.set_value(item.doctype, item.name, "misc_charge_amt", misc_charge_amt)
        let total_inr_value = isNaN(item.total_inr_value) || item.total_inr_value == null ? 0 : item.total_inr_value;
        let freight_amount = isNaN(item.freight_amount) || item.freight_amount == null ? 0 : item.freight_amount;
        let insurance_amount = isNaN(item.insurance_amount) || item.insurance_amount == null ? 0 : item.insurance_amount;
        let misc_charge_amt1 = isNaN(item.misc_charge_amt) || item.misc_charge_amt == null ? 0 : item.misc_charge_amt;

        let total_amount = total_inr_value + freight_amount + insurance_amount + misc_charge_amt1;

        frappe.model.set_value(item.doctype, item.name, 'total_amount', total_amount);
    })
}

function calculation_tax(frm) {
    frm.doc.item_details.forEach(item => {
        var bcd_amount = (item.bcd_ * item.total_amount) / 100
        frappe.model.set_value(item.doctype, item.name, 'bcd_amount', bcd_amount)
        var hcs_amount = (item.hcs_ * item.total_amount) / 100
        frappe.model.set_value(item.doctype, item.name, 'hcs_amount', hcs_amount)

        var swl_total = bcd_amount + hcs_amount
        var swl_amount = (item.swl_ * swl_total) / 100
        frappe.model.set_value(item.doctype, item.name, 'swl_amount', swl_amount)

        var total_duty = bcd_amount + hcs_amount + swl_amount + item.total_amount
        frappe.model.set_value(item.doctype, item.name, 'total_duty', total_duty)

        var igst_amount = (item.igst_ * total_duty) / 100
        frappe.model.set_value(item.doctype, item.name, 'igst_amount', igst_amount)

        let final_duty = item.total_duty_forgone + item.hcs_amount + item.swl_amount + item.igst_amount

        frappe.model.set_value(item.doctype, item.name, "final_total_duty", final_duty)

        var total = item.freight_amount + item.insurance_amount + item.bcd_amount + item.hcs_amount + item.swl_amount + item.igst_amount
        frappe.model.set_value(item.doctype, item.name, 'total', total)
    })
    frm.refresh_field('item_details');
}

function total_calculations(frm) {
    let accessible_val = frm.doc.total_inr_val + frm.doc.freight_amt + frm.doc.ex_works + frm.doc.insurance_amount
    frm.set_value("accessible_val", accessible_val)

    let total_bcd_amount = 0
    let total_h_cess_amount = 0
    let total_sws_amount = 0
    let total_igst_amount = 0
    let total_freight_amount = 0
    let total_duty = 0

    frm.doc.item_details.forEach(item => {
        total_bcd_amount += item.bcd_amount
        total_h_cess_amount += item.hcs_amount
        total_sws_amount += item.swl_amount
        total_igst_amount += item.igst_amount
        total_freight_amount += item.freight_amount
        total_duty += item.final_total_duty
    })

    frm.set_value("bcd_amount", total_bcd_amount)
    frm.set_value("h_cess_amount", total_h_cess_amount)
    frm.set_value("sws_amount", total_sws_amount)
    frm.set_value("igst_amount", total_igst_amount)
    frm.set_value("total_freight", total_freight_amount)
    frm.set_value("total_duty", total_duty)

    frappe.show_alert({
        message: __('Hi, Calculation Completed'),
        indicator: 'green'
    }, 5);

}



function calculation_of_rodtep(frm) {
    let rodtep_total = 0;
    $.each(frm.doc.rodtep_details || [], function (i, d) {
        rodtep_total += d.amount;
    });

    frm.set_value("rem_rodtep", rodtep_total);

    let total_rodtep_utilization = 0
    $.each(frm.doc.item_details || [], function (i, d) {
        if (rodtep_total > 0) {

            let remaining = rodtep_total - d.bcd_amount;

            d.rodtep_utilization = d.bcd_amount;
            if (remaining < 0) {
                d.total_duty_forgone = Math.abs(remaining);
                rodtep_total = 0;
            } else {
                d.total_duty_forgone = 0;
                rodtep_total = remaining;
            }
        } else {
            d.rodtep_utilization = 0;
            d.total_duty_forgone = d.bcd_amount || 0;
        }
        if (d.bcd_amount != d.total_duty_forgone) {
            total_rodtep_utilization += d.bcd_amount
            total_rodtep_utilization -= d.total_duty_forgone
        }
    });
    frm.set_value("tot_rodt_ut", total_rodtep_utilization)
    frm.refresh_field("item_details");
}

function calculation_used_rodtep(frm) {
    var total_rodtep_used = frm.doc.tot_rodt_ut;

    $.each(frm.doc.rodtep_details || [], function (i, d) {
        if (total_rodtep_used >= d.amount) {
            d.used_rodtep = d.amount;
            total_rodtep_used -= d.amount;
        } else {
            d.used_rodtep = total_rodtep_used;
            total_rodtep_used = 0;
        }
    });
    frm.refresh_field("rodtep_details");

}

function update_rodtep_base_on_used(frm) {
    $.each(frm.doc.rodtep_details || [], function (i, d) {
        frappe.call({
            method: "import.import.doctype.pre_alert.pre_alert.update_rodtep",
            args: {
                name: d.script_no,
                use_rodtep: d.used_rodtep
            }
        })
    })
}

function send_email_to_cha(frm) {
    frappe.call({
        method: "import.import.doctype.pre_alert.pre_alert.send_mail_to_cha",
        args: {
            sender: frappe.session.user,
            cha_name: frm.doc.cha,
            doc_name: frm.doc.name
        },
        callback: function (r) {
            frappe.show_alert({
                message: __('Email Is Sent For Cha'),
                indicator: 'green'
            }, 5)
        }
    })
}

// comment table in comments tab section
frappe.ui.form.on('Pre Alert', {
    refresh: function (frm) {
        let crm_notes = `
            <div class="notes-section col-xs-12">
                <div class="all-notes" id="all_notes_section">
                    <!-- Existing notes will be displayed here -->
                </div>
            </div>
            <style>
                .comment-content {
                    border: 1px solid var(--border-color);
                    border-radius: 5px;
                    padding: 8px;
                    background: #f8f9fa;
                    margin-bottom: 8px;
                }
                .comment-content table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .comment-content td {
                    padding: 8px;
                }
                .comment-content th {
                    font-weight: bold;
                    text-align: left;
                    padding: 8px;
                }
                .no-activity {
                    text-align: center;
                    color: #888;
                    padding: 10px;
                }
            </style>`;

        frm.get_field("custom_notes_html").wrapper.innerHTML = crm_notes;

        let allNotesSection = document.getElementById("all_notes_section");

        if (!allNotesSection) {
            console.error("all_notes_section not found!");
            return;
        }

        if (frm.doc.custom_crm_note && frm.doc.custom_crm_note.length > 0) {
            let tableHTML = `
                <div class="comment-content">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:30%">Added By</th>
                                <th style="width:40%">Reason</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                    </table>
                </div>`;

            frm.doc.custom_crm_note.forEach((note) => {
                tableHTML += `
                <div class="comment-content">
                    <table>
                        <tr>
                            <td style="width:30%">${note.added_by}</td>
                            <td style="width:40%">${note.note}</td>
                            <td>${frappe.datetime.global_date_format(note.added_on)}</td>
                        </tr>
                    </table>
                </div>`;
            });

            allNotesSection.innerHTML = tableHTML;
        } else {
            allNotesSection.innerHTML = `<p class="no-activity">No Notes Available</p>`;
        }
    }
});



frappe.ui.form.on('Pre Alert', {
    async onload(frm) {
        if (frm.doc.docstatus !== 1) return;

        // If already edited once, lock it
        if (frm.doc.cha_edited_once === 1) {
            frm.set_read_only();
            return;
        }

        if (!frm.doc.cha) {
            frm.set_read_only();
            return;
        }

        const cha_supplier = await frappe.db.get_doc("Supplier", frm.doc.cha);
        const allowed_users = (cha_supplier.portal_users || []).map(u => u.user);
        const is_cha_user = allowed_users.includes(frappe.session.user);

        if (is_cha_user) {
            frm._is_cha_user = true;  // flag for use in save
            frappe.show_alert("You can edit this Pre Alert once.");
        } else {
            frm.set_read_only();
        }
    },

    async after_save(frm) {
        if (frm.doc.docstatus === 1 && frm._is_cha_user && !frm.doc.cha_edited_once) {
            await mark_cha_edited_once(frm);
        }
    }
    
});

// Define as separate helper function
async function mark_cha_edited_once(frm) {
    await frappe.call({
        method: "frappe.client.set_value",
        args: {
            doctype: "Pre Alert",
            name: frm.doc.name,
            fieldname: "cha_edited_once",
            value: 1
        },
        callback: () => {
            frappe.show_alert("Marked as edited once.");
        }
    });
}


// // Copyright (c) 2025, Pragati Dike and contributors
// // For license information, please see license.txt

// frappe.ui.form.on('Pre Alert', {
//     refresh: function(frm) {
//         // Add button to fetch from Pickup Request (only in draft mode)
//         if (frm.doc.docstatus === 0 && !frm.doc.pickup_request) {
//             frm.add_custom_button(__('Get from Pickup Request'), function() {
//                 show_pickup_request_dialog(frm);
//             });
//         }
//     },
    
//     pickup_request: function(frm) {
//         if (frm.doc.pickup_request) {
//             fetch_pickup_request_details(frm);
//         }
//     }
// });

// function show_pickup_request_dialog(frm) {
//     // Fetch Pickup Requests that don't have Pre Alerts yet
//     frappe.call({
//         method: 'import.import.doctype.pre_alert.pre_alert.get_available_pickup_requests',
//         callback: function(r) {
//             if (r.message && r.message.length > 0) {
//                 let d = new frappe.ui.Dialog({
//                     title: 'Select Pickup Request',
//                     fields: [
//                         {
//                             fieldname: 'pickup_request',
//                             label: 'Pickup Request',
//                             fieldtype: 'Select',
//                             options: r.message.map(pr => pr.name),
//                             reqd: 1
//                         },
//                         {
//                             fieldname: 'pickup_details',
//                             label: 'Details',
//                             fieldtype: 'HTML'
//                         }
//                     ],
//                     primary_action_label: 'Get Items',
//                     primary_action: function(values) {
//                         frm.set_value('pickup_request', values.pickup_request);
//                         d.hide();
//                     }
//                 });
                
//                 // Show pickup request details when selected
//                 d.fields_dict.pickup_request.$input.on('change', function() {
//                     let selected_pr = $(this).val();
//                     let pr_data = r.message.find(pr => pr.name === selected_pr);
                    
//                     if (pr_data) {
//                         let html = `
//                             <div style="padding: 10px; background: #f8f9fa; border-radius: 4px; margin-top: 10px;">
//                                 <table class="table table-bordered" style="margin: 0;">
//                                     <tr>
//                                         <td><strong>Total Quantity:</strong></td>
//                                         <td>${pr_data.total_picked_quantity || 0}</td>
//                                     </tr>
//                                     <tr>
//                                         <td><strong>Grand Total:</strong></td>
//                                         <td>${format_currency(pr_data.grand_total || 0, pr_data.currency)}</td>
//                                     </tr>
//                                     <tr>
//                                         <td><strong>Items Count:</strong></td>
//                                         <td>${pr_data.items_count || 0}</td>
//                                     </tr>
//                                 </table>
//                             </div>
//                         `;
//                         d.fields_dict.pickup_details.$wrapper.html(html);
//                     }
//                 });
                
//                 d.show();
//             } else {
//                 frappe.msgprint({
//                     title: __('No Pickup Requests Available'),
//                     message: __('All submitted Pickup Requests already have Pre Alerts created.'),
//                     indicator: 'orange'
//                 });
//             }
//         }
//     });
// }

// function fetch_pickup_request_details(frm) {
//     if (!frm.doc.pickup_request) return;
    
//     frappe.call({
//         method: 'import.import.doctype.pre_alert.pre_alert.get_pickup_request_details',
//         args: {
//             pickup_request: frm.doc.pickup_request
//         },
//         callback: function(r) {
//             if (r.message) {
//                 let data = r.message;
                
//                 // Set header fields
//                 frm.set_value('rfq_number', data.rfq_number);
//                 frm.set_value('vendor', data.vendor);
//                 frm.set_value('currency', data.currency);
//                 frm.set_value('exch_rate', data.conversion_rate);
//                 frm.set_value('total_doc_val', data.grand_total);
//                 frm.set_value('total_inr_val', data.base_grand_total);
                
//                 // Clear and populate item details
//                 frm.clear_table('item_details');
                
//                 if (data.items && data.items.length > 0) {
//                     data.items.forEach(function(item) {
//                         let row = frm.add_child('item_details');
//                         row.item_code      = item.item;
//                         row.item_name      = item.material;
//                         row.description    = item.material_desc;
                        
//                         // Corrected mappings for your child table
//                         row.po_no          = item.po_number;      // PO No
//                         row.quantity       = item.pick_qty;       // Qty
//                         row.item_price     = item.rate;           // Rate
//                         row.amount         = item.amount;         // Amount
//                         row.total_inr_value = item.amount_in_inr; // Amount in INR
//                         row.currency       = item.currency;       // Currency
//                         row.currency_rate  = item.currency_rate;  // Currency Rate
//                     });
//                 }
                
//                 frm.refresh_field('item_details');
                
//                 frappe.show_alert({
//                     message: __('Pickup Request details fetched successfully'),
//                     indicator: 'green'
//                 }, 5);
//             }
//         }
//     });
// }



